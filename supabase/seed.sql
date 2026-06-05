do $$
declare
  demo_owner_id uuid;
  demo_business_id uuid := '00000000-0000-4000-9000-000000000001';
begin
  select id into demo_owner_id
  from public.profiles
  order by created_at asc
  limit 1;

  if demo_owner_id is null then
    raise notice 'BusinessHub seed skipped: create at least one authenticated user/profile first.';
    return;
  end if;

  insert into public.businesses (id, owner_id, name, type)
  values (demo_business_id, demo_owner_id, 'Demo Beauty Studio', 'Салон красоты')
  on conflict (id) do nothing;

  insert into public.services (id, business_id, name, category, price, duration_minutes, active)
  values
    ('00000000-0000-4000-9000-000000000101', demo_business_id, 'Стрижка и укладка', 'Основные', 25, 60, true),
    ('00000000-0000-4000-9000-000000000102', demo_business_id, 'Окрашивание', 'Премиум', 80, 150, true)
  on conflict (id) do nothing;

  insert into public.clients (id, business_id, name, phone, email, notes, visits_count, telegram)
  values
    (
      '00000000-0000-4000-9000-000000000201',
      demo_business_id,
      'Алина Морозова',
      '+996 700 123 456',
      'alina@example.com',
      'Предпочитает утренние записи',
      8,
      '@alina'
    ),
    (
      '00000000-0000-4000-9000-000000000202',
      demo_business_id,
      'Тимур Садыков',
      '+996 555 777 222',
      'timur@example.com',
      'VIP клиент',
      14,
      '@timur'
    )
  on conflict (id) do nothing;
end $$;
