alter type public.appointment_status add value if not exists 'no_show';

alter table public.revenues
add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

create index if not exists revenues_business_appointment_idx
on public.revenues (business_id, appointment_id);

create unique index if not exists revenues_unique_appointment_idx
on public.revenues (appointment_id)
where appointment_id is not null;
