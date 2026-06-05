# BusinessHub

BusinessHub — production-ready SaaS CRM для малого сервисного бизнеса: салоны красоты, барбершопы, автомойки, СТО, репетиторство, фитнес-тренеры, медицинские кабинеты, фотографы, клининг-компании и другие сервисные ниши.

## Stack

- Frontend: Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn-style UI, Framer Motion, TanStack Query, Zustand
- Backend: Supabase, PostgreSQL, RLS
- Payments: Paddle
- Notifications: Telegram Bot API
- Quality: ESLint, Prettier, Husky, Zod, React Hook Form, Vitest
- Infrastructure: Docker, Docker Compose, GitHub Actions, Vercel

## Install

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Environment

Configure `.env.local`. A placeholder file is included for local setup; replace every `your-*` value before using real integrations:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PADDLE_API_KEY=your-paddle-api-key
PADDLE_WEBHOOK_SECRET=your-paddle-webhook-secret
PADDLE_ENVIRONMENT=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=your-paddle-client-token
TELEGRAM_BOT_TOKEN=123456:telegram-bot-token
TELEGRAM_WEBHOOK_SECRET=change-me
```

## Supabase

1. Create a Supabase project at https://supabase.com/dashboard.
2. Open `Project Settings -> API`.
3. Copy `Project URL` into `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy `Project API keys -> anon public` into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Copy `Project API keys -> service_role secret` into `SUPABASE_SERVICE_ROLE_KEY`. Keep this server-only.
6. Enable Email auth and Google OAuth in `Authentication -> Providers`.
7. Link the project with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
```

8. Apply migrations with the Supabase CLI:

```bash
npm run db:migrate
```

This runs `npx supabase db push` and applies every SQL file from `supabase/migrations` to the linked project.

If you do not want to use the CLI, apply the schema manually:

1. Open `Supabase Dashboard -> SQL Editor`.
2. Click `New query`.
3. Paste and run the contents of these files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_add_service_description.sql`
   - `supabase/migrations/003_production_service_appointment_constraints.sql`
   - `supabase/migrations/004_add_client_telegram.sql`
   - `supabase/migrations/005_client_constraints.sql`
4. Open `Table Editor` and confirm these tables exist: `profiles`, `businesses`, `clients`, `services`, `appointments`, `expenses`, `revenues`, `subscriptions`, `payments`, `notifications`.

After the migration is applied, registration can create a Supabase Auth user, then insert the matching `profiles` and `businesses` rows.

9. Create at least one user through the app or Supabase Auth. The seed script attaches demo data to the first profile.
10. Run seed data locally with:

```bash
npm run db:seed
```

For a remote/staging project, review `supabase/seed.sql` first and run it from the Supabase SQL editor after creating a test owner.
Generate fresh DB types with Supabase CLI when schema changes.

The migration creates:

- `profiles`
- `businesses`
- `clients`
- `appointments`
- `services`
- `expenses`
- `revenues`
- `subscriptions`
- `payments`
- `notifications`

RLS policies restrict tenant data to the business owner.

If the app returns `Supabase is not configured`, the API response includes `missingEnv` and `placeholderEnv`. Fill those values in `.env.local` from `Supabase -> Project Settings -> API`, then restart `npm run dev`.

## Paddle

Create Paddle products/prices:

- Free: limited to 50 clients and 100 appointments
- Pro: `$10/month`
- Business: `$20/month`

Set webhook endpoint:

```text
https://your-domain.com/api/paddle/webhook
```

Store webhook secret in `PADDLE_WEBHOOK_SECRET`.

## Telegram Bot

1. Create a bot through BotFather.
2. Add token to `TELEGRAM_BOT_TOKEN`.
3. Use `/api/telegram` to send reminders.
4. Recommended reminder jobs:
   - one day before appointment
   - two hours before appointment
   - owner notification on new booking

## Docker

```bash
docker compose up --build
```

The app runs on http://localhost:3000 and Postgres on `localhost:5432`.

## CI/CD

GitHub Actions workflow runs:

- install
- lint
- type check
- tests
- build

## Vercel Deploy

1. Import the repository in Vercel.
2. Add all environment variables.
3. Set Supabase auth redirect URLs:
   - `https://your-domain.com/login`
   - `https://your-domain.com/onboarding`
4. Deploy.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run db:migrate
npm run db:seed
```

## Pages

- `/` landing
- `/login`
- `/register`
- `/onboarding`
- `/dashboard`
- `/clients`
- `/appointments`
- `/services`
- `/finance`
- `/analytics`
- `/telegram`
- `/billing`
- `/admin`

## API Routes

- `GET/POST /api/clients`
- `GET/POST /api/appointments`
- `GET/POST /api/services`
- `GET /api/analytics`
- `POST /api/telegram`
- `POST /api/paddle/webhook`
