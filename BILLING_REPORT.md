# BusinessHub Billing Report

## Что реализовано

- Подключена модель подписок Free / Pro / Business через Paddle.js checkout.
- Добавлены API routes:
  - `/api/billing/checkout`
  - `/api/billing/portal`
  - `/api/billing/webhook`
  - `/api/billing/subscription`
  - `/api/billing/status`
- `/api/paddle/webhook` оставлен как совместимый alias на новый billing webhook.
- Webhook проверяет Paddle signature и обрабатывает:
  - `subscription.created`
  - `subscription.updated`
  - `subscription.canceled`
  - `transaction.completed`
- `subscriptions` обновляется по `business_id`, Paddle subscription/customer/price id и датам биллинга.
- `payments` обновляется по `paddle_transaction_id` без дублей.
- Billing page показывает текущий план, статус, дату следующего списания и лимиты.
- Pro и Business открывают Paddle Checkout.
- Кнопка управления подпиской открывает Paddle Customer Portal.
- Sidebar Plan Card показывает реальный план, статус, дату продления, лимиты и Upgrade/Manage.
- Free limits применяются на backend:
  - 50 клиентов
  - 100 записей
- При превышении лимита create client/appointment возвращает `402 PLAN_LIMIT_REACHED`, а UI показывает Upgrade modal.
- Super admin может вручную менять план пользователя через Admin Panel; изменение сохраняется в `subscriptions`.
- Добавлена миграция `supabase/migrations/011_paddle_billing.sql`.
- Добавлены E2E-сценарии billing/subscription/admin limit flows.

## Env

Нужны переменные:

```env
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_ENVIRONMENT=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
PADDLE_PRO_PRICE_ID=
PADDLE_BUSINESS_PRICE_ID=
```

Секретные ключи `PADDLE_API_KEY` и `PADDLE_WEBHOOK_SECRET` используются только на сервере.

## Как создать продукты в Paddle

1. Откройте Paddle Dashboard.
2. Создайте продукт `BusinessHub Pro`.
3. Создайте recurring monthly price `$10`.
4. Скопируйте Price ID в `PADDLE_PRO_PRICE_ID`.
5. Создайте продукт `BusinessHub Business`.
6. Создайте recurring monthly price `$20`.
7. Скопируйте Price ID в `PADDLE_BUSINESS_PRICE_ID`.
8. Включите sandbox для локальной проверки или production для релиза.

## Webhook

1. В Paddle Dashboard создайте webhook endpoint:
   - локально через tunnel: `https://<your-tunnel>/api/billing/webhook`
   - production: `https://your-domain.com/api/billing/webhook`
2. Включите события:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `transaction.completed`
3. Скопируйте webhook secret в `PADDLE_WEBHOOK_SECRET`.
4. Убедитесь, что Paddle Checkout отправляет `customData.business_id`; BusinessHub добавляет его автоматически в checkout payload.

## Sandbox checkout

1. Установите `PADDLE_ENVIRONMENT=sandbox`.
2. Укажите sandbox API key, client token и sandbox price ids.
3. Запустите приложение.
4. Откройте `/billing`.
5. Нажмите Upgrade на Pro или Business.
6. Завершите sandbox checkout.
7. Проверьте, что webhook обновил `subscriptions`.

## Что нужно сделать вручную перед production

- Выполнить SQL migration `supabase/migrations/011_paddle_billing.sql` в Supabase SQL Editor или через `npm run db:migrate`.
- Создать реальные Paddle products/prices.
- Настроить production webhook URL и secret.
- Проверить, что production domain добавлен в Paddle checkout settings.
- Выполнить один реальный sandbox checkout end-to-end с tunnel/webhook.
- Проверить Customer Portal cancellation/downgrade policy в Paddle Dashboard.
