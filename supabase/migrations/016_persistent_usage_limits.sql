alter table public.subscriptions
  add column if not exists served_clients_count integer not null default 0,
  add column if not exists completed_appointments_count integer not null default 0;

alter table public.clients
  add column if not exists served_counted_at timestamptz;

alter table public.appointments
  add column if not exists usage_counted_at timestamptz;

create index if not exists clients_business_served_counted_idx
  on public.clients (business_id, served_counted_at);

create index if not exists appointments_business_usage_counted_idx
  on public.appointments (business_id, usage_counted_at);

create unique index if not exists subscriptions_business_unique_idx
  on public.subscriptions (business_id);

update public.appointments
set usage_counted_at = coalesce(usage_counted_at, created_at, now())
where status = 'completed'
  and usage_counted_at is null;

update public.clients
set served_counted_at = coalesce(served_counted_at, first_completed.first_completed_at)
from (
  select client_id, min(coalesce(usage_counted_at, created_at, now())) as first_completed_at
  from public.appointments
  where status = 'completed'
  group by client_id
) as first_completed
where clients.id = first_completed.client_id
  and clients.served_counted_at is null;

update public.subscriptions
set
  served_clients_count = usage_counts.served_clients_count,
  completed_appointments_count = usage_counts.completed_appointments_count
from (
  select
    businesses.id as business_id,
    coalesce((
      select count(*)::integer
      from public.clients
      where clients.business_id = businesses.id
        and clients.served_counted_at is not null
    ), 0) as served_clients_count,
    coalesce((
      select count(*)::integer
      from public.appointments
      where appointments.business_id = businesses.id
        and appointments.usage_counted_at is not null
    ), 0) as completed_appointments_count
  from public.businesses
) as usage_counts
where subscriptions.business_id = usage_counts.business_id
  and (
    subscriptions.served_clients_count < usage_counts.served_clients_count
    or subscriptions.completed_appointments_count < usage_counts.completed_appointments_count
  );

create or replace function public.record_completed_appointment_usage(
  p_business_id uuid,
  p_appointment_id uuid,
  p_client_id uuid
)
returns table(served_client_counted boolean, completed_appointment_counted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed_rows integer := 0;
  v_served_rows integer := 0;
  v_plan public.plan_type;
  v_served_count integer := 0;
  v_completed_count integer := 0;
  v_served_limit integer;
  v_completed_limit integer;
  v_client_already_counted boolean := false;
  v_appointment_already_counted boolean := false;
begin
  if not (public.owns_business(p_business_id) or public.is_super_admin()) then
    raise exception 'Not allowed to record usage for this business';
  end if;

  insert into public.subscriptions (business_id, plan, status)
  values (p_business_id, 'free', 'active')
  on conflict (business_id) do nothing;

  select plan, served_clients_count, completed_appointments_count
  into v_plan, v_served_count, v_completed_count
  from public.subscriptions
  where business_id = p_business_id
  for update;

  v_served_limit := case
    when v_plan = 'free' then 50
    when v_plan = 'pro' then 500
    else null
  end;

  v_completed_limit := case
    when v_plan = 'free' then 50
    when v_plan = 'pro' then 500
    else null
  end;

  select exists (
    select 1
    from public.appointments
    where id = p_appointment_id
      and business_id = p_business_id
      and usage_counted_at is not null
  )
  into v_appointment_already_counted;

  select exists (
    select 1
    from public.clients
    where id = p_client_id
      and business_id = p_business_id
      and served_counted_at is not null
  )
  into v_client_already_counted;

  if v_completed_limit is not null
    and not v_appointment_already_counted
    and v_completed_count >= v_completed_limit then
    raise exception 'Completed appointment limit reached for plan %', v_plan;
  end if;

  if v_served_limit is not null
    and not v_client_already_counted
    and v_served_count >= v_served_limit then
    raise exception 'Served client limit reached for plan %', v_plan;
  end if;

  update public.appointments
  set usage_counted_at = now()
  where id = p_appointment_id
    and business_id = p_business_id
    and client_id = p_client_id
    and status = 'completed'
    and usage_counted_at is null;

  get diagnostics v_completed_rows = row_count;

  if v_completed_rows > 0 then
    update public.subscriptions
    set completed_appointments_count = completed_appointments_count + 1
    where business_id = p_business_id;
  end if;

  update public.clients
  set served_counted_at = now()
  where id = p_client_id
    and business_id = p_business_id
    and served_counted_at is null;

  get diagnostics v_served_rows = row_count;

  if v_served_rows > 0 then
    update public.subscriptions
    set served_clients_count = served_clients_count + 1
    where business_id = p_business_id;
  end if;

  return query select v_served_rows > 0, v_completed_rows > 0;
end;
$$;
