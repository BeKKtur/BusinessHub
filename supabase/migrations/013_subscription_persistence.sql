alter table public.subscriptions
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;

update public.subscriptions
set current_period_end = coalesce(current_period_end, next_billed_at)
where next_billed_at is not null
  and current_period_end is null;
