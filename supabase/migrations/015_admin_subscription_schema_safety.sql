alter table public.subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists paddle_customer_id text,
  add column if not exists paddle_subscription_id text,
  add column if not exists paddle_price_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists next_billed_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists portal_url text,
  add column if not exists updated_at timestamptz default now();

update public.subscriptions
set user_id = businesses.owner_id
from public.businesses
where subscriptions.business_id = businesses.id
  and subscriptions.user_id is null;

update public.subscriptions
set paddle_subscription_id = coalesce(paddle_subscription_id, paddle_id)
where paddle_id is not null
  and paddle_subscription_id is null;

update public.subscriptions
set current_period_end = coalesce(current_period_end, next_billed_at)
where next_billed_at is not null
  and current_period_end is null;

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id);

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

create or replace function public.set_subscription_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    select owner_id
    into new.user_id
    from public.businesses
    where id = new.business_id;
  end if;

  return new;
end;
$$;

drop trigger if exists subscriptions_set_user_id on public.subscriptions;

create trigger subscriptions_set_user_id
before insert or update of business_id, user_id on public.subscriptions
for each row
execute function public.set_subscription_user_id();

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
