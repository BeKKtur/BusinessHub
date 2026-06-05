alter table public.subscriptions
  add column if not exists paddle_subscription_id text,
  add column if not exists paddle_customer_id text,
  add column if not exists paddle_price_id text,
  add column if not exists next_billed_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists portal_url text;

update public.subscriptions
set paddle_subscription_id = coalesce(paddle_subscription_id, paddle_id)
where paddle_id is not null;

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
on public.payments (paddle_transaction_id);
