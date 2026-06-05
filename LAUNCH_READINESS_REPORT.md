# BusinessHub Launch Readiness Report

Date: 2026-06-05

## Summary

BusinessHub is substantially closer to a production SaaS after the latest pass: core CRM flows, appointment lifecycle, finance operations, CSV export, auth guards, Supabase-backed CRUD, and E2E coverage are in place.

Current launch readiness: **72/100**.

Verdict: **Do not launch publicly yet as a paid SaaS**. It is suitable for a controlled staging/beta with real Supabase migrations applied. Public launch is blocked by live Paddle subscription lifecycle, admin operations, and final production environment hardening.

## Production-Ready Areas

- Auth-protected app routes redirect unauthenticated users.
- Clients, services, appointments use Supabase-backed APIs and `business_id` scoping.
- Appointment completion creates a single automatic revenue via `appointment_id`.
- Cancelled and no-show appointments do not create revenue.
- Finance supports income/expense create, edit, delete, date filters, and CSV export.
- Topbar `Новая запись` works globally via `/appointments?new=1`.
- Dashboard quick actions route to real flows.
- Demo data is isolated to `/demo`.
- Empty/loading/error states exist on core CRUD pages.
- E2E coverage includes auth, CRUD, appointments, finance, dashboard actions, and layout smoke tests.

## Remaining Blockers

1. **Paddle is not fully live**
   - Checkout route is guarded and configuration-aware, but Paddle.js checkout launch is not implemented end-to-end.
   - Webhook verifies signatures but does not yet persist subscription/payment state.
   - Upgrade, downgrade, cancellation, trial, customer portal, and active subscription enforcement are not complete.
   - Required env still needs real plan price IDs: `PADDLE_STARTER_PRICE_ID`, `PADDLE_PRO_PRICE_ID`, `PADDLE_BUSINESS_PRICE_ID`.

2. **Admin Panel is not operational**
   - The page no longer shows fake metrics, but live admin APIs are still pending.
   - Blocking users and changing plans require a service-role admin endpoint plus audit logs.

3. **Sidebar plan card is not live-synced**
   - It now shows a conservative Free plan state and an Upgrade link.
   - It does not yet read the current subscription from Supabase/Paddle.

4. **Production Supabase must be migrated**
   - Apply all migrations, including `007_ensure_revenue_appointment_link.sql`.
   - Confirm RLS in the live project before launch.

5. **Operational hardening**
   - Add rate limiting to all mutation routes.
   - Add structured server logging and alerting.
   - Add backup/restore process for Supabase.
   - Add staging/prod environment separation.

## Recently Fixed

- Global `+ Новая запись` button.
- Finance `Добавить операцию`.
- Finance `Экспорт`.
- Dashboard `Быстрое действие`.
- Inert fake Admin metrics removed.
- Sidebar plan card made non-fake and upgrade-linked.
- Finance API added for income/expense CRUD.
- Billing checkout API added with auth and configuration checks.

## Required Manual Checks Before Launch

- Run Supabase migrations in the production project:

```bash
npm run db:migrate
```

- Verify these tables exist in Supabase Table Editor:
  - `profiles`
  - `businesses`
  - `clients`
  - `services`
  - `appointments`
  - `expenses`
  - `revenues`
  - `subscriptions`
  - `payments`
  - `notifications`

- Configure Paddle:
  - `PADDLE_API_KEY`
  - `PADDLE_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
  - `PADDLE_STARTER_PRICE_ID`
  - `PADDLE_PRO_PRICE_ID`
  - `PADDLE_BUSINESS_PRICE_ID`

- Test real checkout and webhook events in Paddle sandbox.
- Confirm user A cannot read user B data with real Supabase users.
- Confirm email auth/OAuth redirect URLs in Supabase.

## Test Status

Latest required checks in this pass:

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test`: passed
- `npm run build`: passed

E2E is included in this pass and should remain a required release gate.
