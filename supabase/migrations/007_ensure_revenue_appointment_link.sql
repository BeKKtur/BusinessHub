alter type public.appointment_status add value if not exists 'no_show';

alter table public.revenues
add column if not exists appointment_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'revenues_appointment_id_fkey'
      and conrelid = 'public.revenues'::regclass
  ) then
    alter table public.revenues
    add constraint revenues_appointment_id_fkey
    foreign key (appointment_id) references public.appointments(id) on delete set null;
  end if;
end $$;

create index if not exists revenues_business_appointment_idx
on public.revenues (business_id, appointment_id);

create unique index if not exists revenues_unique_appointment_idx
on public.revenues (appointment_id)
where appointment_id is not null;
