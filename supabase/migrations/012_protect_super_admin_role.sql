do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and udt_name = 'profile_role'
  ) then
    update public.profiles
    set role = 'super_admin'::public.profile_role
    where lower(email) = 'batyrbekovbektur0@gmail.com'
      and role is distinct from 'super_admin'::public.profile_role;
  else
    update public.profiles
    set role = 'super_admin'
    where lower(email) = 'batyrbekovbektur0@gmail.com'
      and role is distinct from 'super_admin';
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role public.profile_role := 'user'::public.profile_role;
begin
  if lower(new.email) = 'batyrbekovbektur0@gmail.com' then
    resolved_role := 'super_admin'::public.profile_role;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', resolved_role)
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = case
      when lower(excluded.email) = 'batyrbekovbektur0@gmail.com'
        then 'super_admin'::public.profile_role
      else public.profiles.role
    end;

  return new;
end;
$$;
