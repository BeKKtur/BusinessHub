alter table public.services
drop constraint if exists services_price_check;

alter table public.services
add constraint services_price_positive_check check (price > 0);

alter table public.services
drop constraint if exists services_name_not_empty_check;

alter table public.services
add constraint services_name_not_empty_check check (length(btrim(name)) > 0);

alter table public.services
drop constraint if exists services_category_not_empty_check;

alter table public.services
add constraint services_category_not_empty_check check (length(btrim(category)) > 0);

create unique index if not exists appointments_unique_scheduled_time_idx
on public.appointments (business_id, starts_at)
where status = 'scheduled';
