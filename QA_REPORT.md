# BusinessHub QA Report

Дата аудита: 2026-06-04

## Что тестировалось

- E2E user flows: auth/onboarding screens, protected route behavior, dashboard smoke, clients CRUD, services CRUD, appointments CRUD, global navigation, theme toggle, notifications button, responsive desktop/mobile layout.
- CRUD persistence behavior in E2E via mocked API layer for `clients`, `services`, `appointments`.
- Production checks: ESLint, TypeScript, Vitest unit tests, Next.js production build, npm audit.
- UI states: validation, empty states, loading/error smoke coverage, toast visibility, calendar filtering, active/inactive service filtering, duplicate appointment warning.

## Проверенные страницы

- `/`
- `/login`
- `/register`
- `/onboarding`
- `/dashboard`
- `/clients`
- `/services`
- `/appointments`
- `/finance`
- `/analytics`
- `/telegram`
- `/billing`
- `/admin`

## Найденные баги

- Vitest запускал Playwright spec-файлы и падал из-за смешивания test runners.
- TypeScript подхватывал generated `next-build`/E2E artifacts в production typecheck/build.
- E2E fixture имел слишком узкий inferred type для клиентов.
- Новая appointment form автозаполняла первого клиента и услугу, обходя обязательную validation flow.
- Toast с более высоким z-index перекрывал modal close button.
- Mobile sidebar navigation тестировал недоступную off-canvas ссылку без открытия меню.
- Appointment modal на mobile имел горизонтальный overflow, из-за чего hit testing у submit button ломался.
- После refresh appointment test не выбирал дату записи в календаре и видел empty state другого дня.
- Native `required` на части полей конфликтовал с единым Zod/RHF validation подходом.

## Исправленные баги

- Разделены unit и E2E test suites через `vitest.config.ts`.
- `tsconfig.json` ограничен production/source контекстом и исключает E2E/report/build artifacts.
- Добавлены Playwright E2E config, desktop/mobile projects и mock CRUD backend.
- Appointment create form теперь требует явного выбора клиента и active-услуги.
- CRUD модалки подняты выше toast-слоя.
- Topbar menu button получил `aria-label="Открыть меню"`.
- Appointment modal перестроен на flex dialog: header, scrollable body, отдельный footer.
- Глобальный и appointment-grid horizontal overflow зажат через `overflow-x: hidden`, `min-w-0`, `minmax(0, ...)`.
- Добавлен явный mobile viewport metadata.
- Убрана native required-валидация там, где работает Zod/RHF.
- Playwright artifacts добавлены в `.gitignore`.

## Добавленные тесты

- `e2e/auth-onboarding.spec.ts`
- `e2e/crud-flows.spec.ts`
- `e2e/global-smoke.spec.ts`
- `e2e/helpers/businesshub-fixtures.ts`

Покрытие E2E:

- Auth/register/login/onboarding page loading.
- Protected route behavior documented for local no-env mode.
- Clients: create, required validation, edit, search, refresh persistence, delete.
- Services: create, required validation, edit, active/inactive toggle, refresh persistence, delete.
- Appointments: create, required validation, active service filtering, duplicate time warning, calendar filtering, refresh persistence, edit, delete.
- Global: dashboard/finance/analytics/telegram/billing/admin smoke, sidebar navigation, theme toggle, notification button, appointment layout bounds.

## Проверки

- `npm run test:e2e`: passed, 26/26.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 2/2.
- `npm run build`: passed.
- `npm audit`: passed, 0 vulnerabilities.

## Ограничения

- В workspace нет `.env` или `.env.local`, поэтому live Supabase connection, remote RLS policies, real table existence and persistence were not verified against an actual Supabase project.
- Paddle checkout/customer portal/webhook and Telegram Bot API were smoke-tested only at page/API-surface level available locally; real provider credentials and sandbox callbacks still need manual verification.
- Admin authorization is covered as a known product gap in local no-env mode; real role enforcement must be validated with Supabase auth claims/RLS before deploy.
- Finance, analytics, billing and telegram advanced workflows still need deeper provider-backed E2E once their production APIs and test credentials are configured.

## Перед деплоем вручную

- Configure `.env.local` from `.env.example`.
- Run Supabase migrations on a staging project and verify RLS with non-admin and admin users.
- Run E2E against staging with real Supabase test users.
- Verify Google OAuth redirect URLs.
- Verify Paddle sandbox checkout, portal and signed webhook delivery.
- Verify Telegram test bot token, timeout behavior and rate limiting.
- Verify Vercel environment variables and production build settings.
