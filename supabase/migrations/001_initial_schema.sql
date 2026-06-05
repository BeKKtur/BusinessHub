create extension if not exists "pgcrypto";

create type public.profile_role as enum ('owner', 'admin');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'rescheduled');
create type public.plan_type as enum ('free', 'pro', 'business');
create type public.notification_channel as enum ('telegram', 'email');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.profile_role not null default 'owner',
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null,
  timezone text not null default 'Asia/Bishkek',
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  notes text,
  visits_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  category text not null,
  description text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.revenues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  category text not null,
  description text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan public.plan_type not null default 'free',
  status text not null default 'active',
  paddle_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  paddle_transaction_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel public.notification_channel not null,
  type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index clients_business_search_idx on public.clients using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(email, '')));
create index appointments_business_starts_idx on public.appointments (business_id, starts_at);
create index revenues_business_occurred_idx on public.revenues (business_id, occurred_at);
create index expenses_business_occurred_idx on public.expenses (business_id, occurred_at);

create or replace function public.owns_business(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses
    where id = target_business_id and owner_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.expenses enable row level security;
alter table public.revenues enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

create policy "Profiles are self-readable" on public.profiles for select using (id = auth.uid());
create policy "Profiles are self-updatable" on public.profiles for update using (id = auth.uid());

create policy "Owners manage businesses" on public.businesses for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Owners manage clients" on public.clients for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Owners manage services" on public.services for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Owners manage appointments" on public.appointments for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Owners manage expenses" on public.expenses for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Owners manage revenues" on public.revenues for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Owners read subscriptions" on public.subscriptions for select using (public.owns_business(business_id));
create policy "Owners read payments" on public.payments for select using (public.owns_business(business_id));
create policy "Owners manage notifications" on public.notifications for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
