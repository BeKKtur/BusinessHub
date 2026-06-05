# BusinessHub Performance Report

## Что было медленным

- Dashboard тянул полные списки clients/services и считал часть метрик на больших массивах.
- Appointments API возвращал все записи за всё время, хотя календарю нужен текущий месяц.
- Clients page загружала весь список без лимита, а поиск пересчитывался на каждый символ.
- Client-side страницы повторно refetch-или данные при возврате между разделами.
- Между route transitions не было общего `loading.tsx`, поэтому переходы могли ощущаться как зависание.
- Sidebar plan card был статичным и не использовал server-side subscription context.

## Оптимизированные запросы

- Dashboard:
  - заменил полный clients pull на count-запрос;
  - activity берёт только последние несколько clients/services;
  - сегодняшние appointments остаются ограничены сегодняшним диапазоном;
  - revenue/month queries ограничены нужными date ranges.
- Clients:
  - `/api/clients` получил `limit` с safe cap до 200;
  - UI запрашивает `/api/clients?limit=100`;
  - поиск debounce 250 ms.
- Appointments:
  - `/api/appointments` получил `from/to`;
  - UI запрашивает записи только выбранного месяца;
  - query key включает месяц, чтобы кэшировать календарные диапазоны.
- TanStack Query:
  - общий `staleTime` увеличен до 120 секунд;
  - добавлен `gcTime`;
  - services, clients, appointments, finance, telegram, billing, admin получили явный `staleTime`.
- Billing:
  - subscription status вынесен в `/api/billing/status`;
  - billing page показывает cached current plan/status.

## Индексы

Создана migration:

```bash
supabase/migrations/010_performance_indexes.sql
```

Добавлены индексы:

- `clients (business_id, created_at desc)`
- `services (business_id, created_at desc)`
- `services (business_id, active)`
- `appointments (business_id, status)`
- `appointments (business_id, client_id)`
- `appointments (business_id, service_id)`
- `appointments (business_id, created_at desc)`
- `revenues (business_id, created_at desc)`
- `expenses (business_id, created_at desc)`
- `notifications (business_id, channel, type)`

Migration нужно выполнить в Supabase SQL Editor перед production deploy.

## Улучшенные компоненты

- Добавлен route-level skeleton: `src/app/(app)/loading.tsx`.
- Sidebar получает role/plan/subscription status из server layout.
- Clients search стал debounced.
- Appointments calendar использует month-range cache.
- Admin/Billing/Telegram pages кэшируют data queries.

## Проверки

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — passed.
- `npm run build` — passed.
- `npm run test:e2e -- e2e/crud-flows.spec.ts e2e/new-user-empty-workspace.spec.ts` — passed, 16/16.
- `npm run test:e2e` — passed, 76/76.

## Что ещё улучшить

- Перевести finance list на backend pagination/date filters для очень больших аккаунтов.
- Добавить Supabase RPC для monthly analytics aggregation, чтобы не строить series в Node.
- Объединить admin overview в один `/api/admin/overview`, чтобы вместо 5 запросов делать один.
- Добавить real browser performance budget в CI: Lighthouse или Playwright trace assertions.
- Добавить virtualized tables для clients/finance при тысячах строк.
