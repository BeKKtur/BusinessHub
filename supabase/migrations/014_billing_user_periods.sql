alter table public.subscriptions
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;

update public.subscriptions
set user_id = businesses.owner_id
from public.businesses
where subscriptions.business_id = businesses.id
  and subscriptions.user_id is null;

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id);

update public.subscriptions
set current_period_end = coalesce(current_period_end, next_billed_at)
where next_billed_at is not null
  and current_period_end is null;
