# BusinessHub Roadmap: 6 Months

## Month 1: Production Foundation

- Replace demo data with Supabase CRUD for clients, services, appointments, finance and analytics.
- Implement email/password auth, Google OAuth callbacks and onboarding persistence.
- Add tenant-aware repository layer for all business-scoped queries.
- Add role model for owner, staff and platform admin.
- Add Sentry or equivalent error monitoring with release tracking.
- Add baseline E2E tests for auth, onboarding, client creation and appointment creation.

## Month 2: CRM Core

- Build full client lifecycle: create, edit, delete, merge duplicates and visit history.
- Build appointment lifecycle: create, reschedule, cancel, complete and no-show.
- Add service categories, staff assignment and availability rules.
- Add search, filtering, pagination and CSV export for clients and appointments.
- Add plan limit enforcement for Free tier: 50 clients and 100 appointments.
- Add audit log table and admin activity feed.

## Month 3: Calendar and Operations

- Add day, week and month calendar views.
- Add drag-and-drop appointment rescheduling.
- Add recurring appointments and blocked time.
- Add staff schedules, breaks and multi-location support foundation.
- Add conflict detection for overlapping appointments.
- Add mobile-first quick booking flow for owners on the go.

## Month 4: Billing and Monetization

- Complete Paddle checkout integration for Pro and Business plans.
- Persist Paddle subscriptions, payments and plan changes through verified webhooks.
- Add customer portal links for invoice history and subscription management.
- Add dunning states, grace periods and locked-feature UI.
- Add billing analytics for platform MRR, churn and conversion.
- Add pricing experiments and coupon support.

## Month 5: Telegram and Automation

- Add Telegram bot connection flow with webhook verification.
- Add automated reminders one day and two hours before appointment.
- Add owner notifications for new, changed and cancelled bookings.
- Add message templates per business type.
- Add notification delivery logs, retries and failure alerts.
- Add Business-tier automation builder for common service workflows.

## Month 6: Analytics and Scale

- Add advanced analytics: cohort retention, repeat rate, service profitability and booking conversion.
- Add monthly revenue reports and expense/profit dashboards.
- Add PDF and CSV exports for financial reports.
- Add admin-level platform dashboards and support tooling.
- Add performance budgets, bundle analysis and database query monitoring.
- Prepare public launch checklist: legal pages, backup policy, incident playbook and support documentation.

## Ongoing Quality Bar

- Keep `npm audit` at 0 vulnerabilities.
- Maintain green `lint`, `typecheck`, `test` and `build` in CI.
- Add E2E coverage before each billing, auth or data-security release.
- Review RLS policies on every schema migration.
- Run accessibility checks for all new UI surfaces.
