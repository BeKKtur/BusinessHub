# BusinessHub Final Pre-Launch QA Report

Дата проверки: 2026-06-06

## Что проверялось

- Public pages: `/`, `/pricing`, `/terms`, `/privacy`, `/refund`, `/contact`
- Auth: email register/login/logout, protected routes, Google OAuth code path
- Dashboard: загрузка статистики, badge текущего плана, usage counters
- Clients: create/edit/delete/search, пустой workspace нового пользователя
- Services: create/edit/delete/status toggle, active-only услуги для записей
- Appointments: создание, client combobox, service select, month navigation, complete/cancel/no-show, mobile layout
- Finance: доходы/расходы, расчет прибыли, CSV export
- Billing: plan persistence, Free/Pro/Business limits, checkout fallback behavior
- Admin: super_admin access, user block/unblock, manual plan grant, subscriptions list
- Telegram: required fields, token check, settings persistence, API error handling
- Mobile QA: Playwright mobile project plus desktop Chromium coverage

## Что прошло

- Public pages are reachable in automated smoke coverage and contact details are visible.
- Protected app routes reject unauthenticated users.
- Email auth flows and logout are covered by E2E tests.
- Dashboard loads without server crashes and handles duplicate activity labels.
- Clients, services, appointments, finance, billing, admin, Telegram, and empty-workspace flows pass E2E.
- New real users do not see demo data; demo data remains isolated to demo mode.
- Billing plan display and limits persist through tested flows.
- Admin manual plan grant, block/unblock, and subscription fallbacks pass focused and full E2E checks.

## Что было исправлено

- Billing status UI no longer crashes when API payload is missing nested `usage` or `payments`.
- Billing checkout now attempts Paddle transaction checkout first and falls back safely to item-mode checkout before using a hosted URL fallback.
- Admin plan grant selector supports direct Pro/Business grants used by existing tests and UI flows.
- Admin grant confirmation no longer blocks ordinary manual grants unless an existing Paddle subscription can be overwritten.
- Free plan limits were normalized to `50 clients / 100 appointments` across plan metadata used by the app.
- Appointment client combobox now has an accessible native select bridge while preserving the searchable shadcn Popover/Command UX.
- Appointment form validation no longer creates duplicate exact client error text.
- Contact page now includes the requested fallback Telegram contact handle.

## Проверки

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run build` — passed
- `npm run test` — passed
- `npm run test:e2e` — passed, 88 tests
- Focused admin/billing E2E — passed, 11 tests

## Оставшиеся launch blockers

- Google OAuth must be verified against the real Supabase Google provider configuration in production:
  - Supabase Site URL must point to the canonical Vercel domain.
  - Supabase Redirect URLs must include production and local `/auth/callback`.
  - Google Client ID and Secret must be configured in Supabase Auth Providers.
- Paddle production approval and live checkout cannot be fully verified locally:
  - Production Paddle products/prices must match `PADDLE_PRO_PRICE_ID` and `PADDLE_BUSINESS_PRICE_ID`.
  - Webhook endpoint and signature secret must be configured in Paddle.
  - A real sandbox or production transaction should be tested before launch.
- Supabase production database must have all migrations applied, especially billing/admin subscription safety migrations.
- Legal pages should be reviewed by the owner or legal counsel before public launch.

## Итог

Automated QA status: passed.

Launch readiness: high for application flows, conditional for public launch pending real Google OAuth, Paddle, and production Supabase configuration verification.
