# BusinessHub Production Readiness Report

Дата аудита: 2026-06-05
Роль аудита: CTO review перед первым публичным релизом.

## Executive Summary

BusinessHub пока нельзя выкладывать в интернет как production SaaS. Проект собирается, типизируется, имеет рабочие CRUD-модули для Clients, Services и Appointments, базовые Supabase migrations/RLS и E2E-покрытие ключевых CRUD flows. Но значительная часть продукта остается статичной или mock-driven: Dashboard, Finance, Analytics, Billing, Telegram UI и Admin. Реальные Supabase/Paddle/Telegram credentials отсутствуют, поэтому внешние интеграции не могут считаться проверенными.

Итоговая оценка готовности: 42/100.

Можно ли выкладывать прямо сейчас: нет. Можно выкладывать только как private staging/demo после заполнения `.env.local`, применения migrations и проверки реальных auth/RLS/payment/telegram flows.

## Что Готово

- Next.js production build проходит.
- ESLint, TypeScript, unit tests и npm audit проходят.
- `.env.local` создан с безопасными placeholders и комментариями, где брать реальные ключи.
- API ошибка Supabase configuration улучшена: возвращает `missingEnv`, `placeholderEnv` и путь `Supabase Dashboard -> Project Settings -> API`.
- Supabase migrations создают требуемые таблицы: `profiles`, `businesses`, `clients`, `services`, `appointments`, `expenses`, `revenues`, `subscriptions`, `payments`, `notifications`.
- RLS включен на всех основных таблицах.
- Clients CRUD работает через Supabase API routes: create/update/delete/list/search UI, loading/error/empty states.
- Services CRUD работает через Supabase API routes: create/update/delete/status toggle/list, loading/error/empty states.
- Appointments CRUD работает через Supabase API routes: create/update/delete/list, active services only, client select, duplicate scheduled time protection, календарная фильтрация, bounded responsive layout.
- Paddle webhook route проверяет подпись через Paddle SDK.
- Telegram API route требует auth, валидирует body, имеет timeout и безопасную ошибку внешнего API.

## Page-by-Page Audit

| Page | Real data vs mock | Create | Update | Delete | Refresh | Supabase persistence | States |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Mock data from `src/lib/mock-data.ts` | No | No | No | Static | No | Skeleton декоративный, нет real loading/error |
| Clients | Supabase API | Yes | Yes | Yes | Yes if real env/RLS | Yes via `clients` | Loading/error/empty present |
| Services | Supabase API | Yes | Yes | Yes | Yes if real env/RLS | Yes via `services` | Loading/error/empty present |
| Appointments | Supabase API | Yes | Yes | Yes | Yes if real env/RLS | Yes via `appointments` | Loading/error/empty present |
| Finances | Static constants | No | No | No | Static | No | No real loading/error/empty |
| Analytics | Static page and `/api/analytics` uses mock revenue series | No | No | No | Static | No | No real loading/error/empty |
| Telegram | Static UI; API can send a message if env exists | Token UI does not save | No | No | No persistence | No settings table integration | No real loading/error/empty in UI |
| Billing | Static pricing cards | Checkout not wired | No | No | Static | No subscription status persistence | No real loading/error/empty |
| Admin | Static metrics/logs | No | No | No | Static | No | No real loading/error/empty; no admin guard |

## Supabase Audit

Tables: present in migrations for all required entities.

Foreign keys:
- `profiles.id -> auth.users(id)`
- `businesses.owner_id -> profiles(id)`
- Tenant tables reference `businesses(id)`.
- `appointments.client_id -> clients(id)`.
- `appointments.service_id -> services(id)`.

Indexes:
- Client search GIN index exists.
- Appointment business/start index exists.
- Revenue/expense date indexes exist.
- Unique partial scheduled appointment index exists on `(business_id, starts_at)` where `status = 'scheduled'`.

RLS:
- Enabled on all required business tables.
- Owner policies exist for businesses and tenant data.
- Subscriptions/payments are read-only for owners.

Migrations:
- Schema is present and ordered.
- Constraints exist for service positivity/name/category, client name/phone/phone format and appointment scheduled uniqueness.

Seed data:
- `supabase/seed.sql` is present and idempotent.
- `npm run db:seed` added. It uses `npx supabase db reset`, which is appropriate for local Supabase. For remote staging, seed should be reviewed and run manually from SQL editor after creating a test owner.

Blockers:
- Live Supabase project was not verified because real keys are not present.
- `SUPABASE_SERVICE_ROLE_KEY` is configured as required but not yet used for privileged server workflows.
- Admin role/RLS model is too thin for a real platform admin panel.

## API Audit

Ready:
- `/api/clients`, `/api/services`, `/api/appointments` validate bodies through Zod.
- These routes require Supabase auth and tenant business context.
- Safe error logging avoids exposing raw secrets.
- `/api/telegram` validates body and has request timeout.
- `/api/paddle/webhook` validates Paddle signature.

Not ready:
- No distributed rate limiting. This is required before public launch.
- `/api/analytics` returns mock/static metrics.
- No API routes for finances CRUD.
- Paddle webhook does not persist events to `subscriptions` or `payments`.
- Telegram route sends messages but does not manage bot token connection, reminders, or persisted settings.
- Auth routes/pages are visual forms, not complete Supabase auth flows.

## Paddle Audit

Ready:
- Webhook endpoint exists.
- Webhook signature validation exists.
- Paddle environment switch supports sandbox/production.

Stubs / missing:
- Billing page buttons do not open Paddle checkout.
- No customer portal flow.
- No subscription status fetch/display from Supabase/Paddle.
- No upgrade/downgrade/cancellation flow.
- Webhook does not write `subscriptions` or `payments`.
- No plan limit enforcement for Free/Pro/Business.

## Telegram Audit

Ready:
- API route can send `sendMessage` when `TELEGRAM_BOT_TOKEN` and Supabase auth are configured.
- Body validation and timeout exist.

Stubs / missing:
- Telegram page does not save bot token.
- No Bot Token validation flow in UI.
- No test-message UI flow.
- Automation toggles are static icons, not persisted switches.
- No reminder scheduler for one day / two hours.
- No notifications table integration for delivery status.
- No robust rate limiting.

## Performance Audit

Ready:
- Static marketing/summary pages are server components by default.
- CRUD-heavy pages isolate client-side state in manager components.
- Production build completed successfully.

Risks:
- Dashboard/Finance/Analytics share chart bundle; `/dashboard`, `/finance`, `/analytics` first-load JS is around 206 kB.
- Clients/services/appointments list all rows without pagination, server-side filtering, or query limits.
- No query indexes for services by `(business_id, active)` or notifications/subscriptions operational queries.
- No caching strategy for dashboard/analytics.
- No instrumentation for slow Supabase queries.

## Заглушки и Demo Data

- `src/lib/mock-data.ts` still drives Dashboard and charts.
- `src/components/charts/revenue-chart.tsx` uses mock revenue series.
- `/api/analytics` returns hardcoded metrics.
- Finance page uses hardcoded revenue/expenses/profit.
- Billing page uses static plans and inert buttons.
- Telegram page is static and does not persist settings.
- Admin page uses static users/MRR/activity/logs.
- Landing page links to `/dashboard` as `Открыть demo`.

## Critical Bugs / Blockers

1. Real Supabase credentials are missing; production data persistence cannot be verified.
2. Public launch would expose multiple static/mock modules as if they were functional product areas.
3. Billing is not wired to Paddle checkout, subscriptions, portal, cancellation or plan limits.
4. Telegram automation is not implemented beyond a basic send-message API.
5. Admin route is not protected by admin role authorization.
6. Finance CRUD and persistence are not implemented.
7. No production-grade rate limiting on API routes.
8. Auth pages are not fully wired to Supabase email/password and Google OAuth flows.

## Medium Bugs / Risks

1. Analytics is hardcoded and not derived from Supabase.
2. Dashboard is hardcoded and does not reflect created clients/services/appointments outside mocked E2E.
3. CRUD APIs list all tenant rows without pagination.
4. Seed requires at least one profile; remote seeding remains a manual staging step.
5. Subscription/payment RLS is read-only for owners but there are no service-role mutation workflows.
6. No observability setup: logs, error tracking, uptime checks, slow query monitoring.
7. No database type regeneration command documented beyond CLI guidance.

## Проверки

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 2/2.
- `npm run build`: passed.
- `npm audit`: passed, 0 vulnerabilities.

## Release Recommendation

Do not launch publicly yet.

Recommended next release gate:
1. Fill `.env.local` with real Supabase staging keys.
2. Apply migrations to staging.
3. Create real test owner and run reviewed seed.
4. Wire Supabase auth forms and middleware redirects.
5. Replace Dashboard/Finance/Analytics/Admin mock data with Supabase-backed APIs.
6. Implement Paddle checkout, webhook persistence, customer portal and plan enforcement.
7. Implement Telegram settings persistence, token validation, test message and reminder scheduler.
8. Add distributed rate limiting and monitoring.
9. Re-run full E2E against staging with real providers.
