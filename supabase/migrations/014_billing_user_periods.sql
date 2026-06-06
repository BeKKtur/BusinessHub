alter table public.subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;

update public.subscriptions
set user_id = businesses.owner_id
from public.businesses
where subscriptions.business_id = businesses.id
  and subscriptions.user_id is null;

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id);

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

update public.subscriptions
set current_period_end = coalesce(current_period_end, next_billed_at)
where next_billed_at is not null
  and current_period_end is null;
