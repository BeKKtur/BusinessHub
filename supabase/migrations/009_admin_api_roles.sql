do $$
begin
  if exists (select 1 from pg_type where typname = 'profile_role') then
    alter type public.profile_role rename to profile_role_old;
  end if;
end $$;

create type public.profile_role as enum ('user', 'admin', 'super_admin');

alter table public.profiles
  add column if not exists blocked boolean not null default false;

alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type public.profile_role
  using case
    when role::text = 'owner' then 'user'::public.profile_role
    when role::text = 'admin' then 'admin'::public.profile_role
    when role::text = 'super_admin' then 'super_admin'::public.profile_role
    else 'user'::public.profile_role
  end,
  alter column role set default 'user';

drop type if exists public.profile_role_old;

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_blocked_idx on public.profiles (blocked);
create index if not exists businesses_owner_idx on public.businesses (owner_id);
create index if not exists subscriptions_business_idx on public.subscriptions (business_id);
create index if not exists payments_business_created_idx on public.payments (business_id, created_at);
create index if not exists admin_activity_logs_created_idx on public.admin_activity_logs (created_at desc);

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and blocked = false
  );
$$;

create or replace function public.owns_business(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses
    join public.profiles on profiles.id = businesses.owner_id
    where businesses.id = target_business_id
      and businesses.owner_id = auth.uid()
      and profiles.blocked = false
  );
$$;

alter table public.admin_activity_logs enable row level security;

drop policy if exists "Profiles are self-updatable" on public.profiles;

drop policy if exists "Super admins read profiles" on public.profiles;
create policy "Super admins read profiles" on public.profiles for select using (public.is_super_admin());

drop policy if exists "Super admins read businesses" on public.businesses;
create policy "Super admins read businesses" on public.businesses for select using (public.is_super_admin());

drop policy if exists "Super admins read subscriptions" on public.subscriptions;
create policy "Super admins read subscriptions" on public.subscriptions for select using (public.is_super_admin());

drop policy if exists "Super admins read payments" on public.payments;
create policy "Super admins read payments" on public.payments for select using (public.is_super_admin());

drop policy if exists "Super admins read admin activity logs" on public.admin_activity_logs;
create policy "Super admins read admin activity logs" on public.admin_activity_logs for select using (public.is_super_admin());
