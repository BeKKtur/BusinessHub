alter table public.clients
drop constraint if exists clients_name_not_empty_check;

alter table public.clients
add constraint clients_name_not_empty_check check (length(btrim(name)) > 0);

alter table public.clients
drop constraint if exists clients_phone_not_empty_check;

alter table public.clients
add constraint clients_phone_not_empty_check check (length(btrim(phone)) > 0);

alter table public.clients
drop constraint if exists clients_phone_format_check;

alter table public.clients
add constraint clients_phone_format_check check (phone ~ '^[+()0-9[:space:]-]{6,24}$');
