# BusinessHub Admin API Report

## Что реализовано

- Добавлен production Admin API на серверных Next.js route handlers.
- Доступ к `/admin` ограничен ролью `super_admin`.
- Все `/api/admin/*` routes проверяют текущую Supabase session и роль через серверный helper.
- `SUPABASE_SERVICE_ROLE_KEY` используется только в серверном helper `src/lib/supabase/admin.ts` и admin route handlers.
- Добавлены роли пользователей: `user`, `admin`, `super_admin`.
- Добавлено поле `profiles.blocked`.
- Добавлена таблица `admin_activity_logs` для audit log admin-действий.
- Блокировка пользователя закрывает доступ к protected routes и tenant-данным через обновленную RLS-функцию `owns_business`.
- Удалена небезопасная RLS self-update policy для `profiles`, чтобы пользователь не мог повысить себе роль.

## Созданные routes

- `GET /api/admin/users` — список пользователей.
- `GET /api/admin/businesses` — список бизнесов.
- `GET /api/admin/subscriptions` — список подписок.
- `GET /api/admin/revenue` — доход платформы по payments.
- `GET /api/admin/activity` — последние admin-действия.
- `POST /api/admin/block-user` — заблокировать пользователя.
- `POST /api/admin/unblock-user` — разблокировать пользователя.
- `POST /api/admin/change-plan` — изменить план пользователя.

## Admin page

`/admin` теперь показывает:

- количество пользователей;
- количество бизнесов;
- активные подписки;
- доход платформы;
- список пользователей;
- список бизнесов;
- список подписок;
- последние действия;
- действия блокировки, разблокировки, смены плана и просмотра бизнеса пользователя.

## Database migration

Создана migration:

```bash
supabase/migrations/009_admin_api_roles.sql
```

Ее нужно выполнить в Supabase SQL Editor перед production-проверкой admin flow.

## Как назначить первого super_admin

После регистрации первого пользователя выполните в Supabase SQL Editor:

```sql
update public.profiles
set role = 'super_admin', blocked = false
where email = 'your-admin-email@example.com';
```

Замените `your-admin-email@example.com` на email реального администратора.

## Проверки

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — passed.
- `npm run build` — passed.
- `npm run test:e2e -- e2e/admin-flows.spec.ts` — passed.
- `npm run test:e2e` — passed, 72/72.

Полный E2E suite запускался на свежем Playwright dev server с `E2E_AUTH_BYPASS=true`.

## Ограничения

- Реальное управление Paddle subscription lifecycle зависит от production Paddle webhook sync.
- Admin revenue считается по таблице `payments`; корректность зависит от реальных Paddle webhooks.
- Для production deploy обязательно хранить `SUPABASE_SERVICE_ROLE_KEY` только в server-side env, не в `NEXT_PUBLIC_*`.
