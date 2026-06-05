alter table public.subscriptions
  add column if not exists paddle_customer_id text,
  add column if not exists paddle_subscription_id text,
  add column if not exists paddle_price_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists next_billed_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists portal_url text,
  add column if not exists updated_at timestamptz default now();

alter table public.payments
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists paddle_transaction_id text,
  add column if not exists status text default 'completed';

alter table public.subscriptions
  alter column updated_at set default now();

alter table public.payments
  alter column status set default 'completed';

update public.subscriptions
set paddle_subscription_id = coalesce(paddle_subscription_id, paddle_id)
where paddle_id is not null
  and paddle_subscription_id is null;

update public.subscriptions
set current_period_end = coalesce(current_period_end, next_billed_at)
where next_billed_at is not null
  and current_period_end is null;

create unique index if not exists subscriptions_business_unique_idx
  on public.subscriptions (business_id);

create unique index if not exists subscriptions_paddle_subscription_unique_idx
  on public.subscriptions (paddle_subscription_id)
  where paddle_subscription_id is not null;

create index if not exists subscriptions_customer_idx
  on public.subscriptions (paddle_customer_id)
  where paddle_customer_id is not null;

create index if not exists subscriptions_status_plan_idx
  on public.subscriptions (status, plan);

create unique index if not exists payments_paddle_transaction_unique_idx
  on public.payments (paddle_transaction_id)
  where paddle_transaction_id is not null;

create index if not exists payments_business_created_idx
  on public.payments (business_id, created_at);

alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

create or replace function public.set_subscriptions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_subscriptions_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Owners read subscriptions'
  ) then
    create policy "Owners read subscriptions"
      on public.subscriptions
      for select
      using (public.owns_business(business_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Super admins read subscriptions'
  ) then
    create policy "Super admins read subscriptions"
      on public.subscriptions
      for select
      using (public.is_super_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Super admins manage subscriptions'
  ) then
    create policy "Super admins manage subscriptions"
      on public.subscriptions
      for all
      using (public.is_super_admin())
      with check (public.is_super_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'Owners read payments'
  ) then
    create policy "Owners read payments"
      on public.payments
      for select
      using (public.owns_business(business_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'Super admins read payments'
  ) then
    create policy "Super admins read payments"
      on public.payments
      for select
      using (public.is_super_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'Super admins manage payments'
  ) then
    create policy "Super admins manage payments"
      on public.payments
      for all
      using (public.is_super_admin())
      with check (public.is_super_admin());
  end if;
end $$;
