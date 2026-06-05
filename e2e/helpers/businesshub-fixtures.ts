import { expect, type Page } from "@playwright/test";

type Client = {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  telegram: string | null;
  visits_count: number;
  created_at: string;
};

type Service = {
  id: string;
  business_id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
};

type Appointment = {
  id: string;
  business_id: string;
  client_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  created_at: string;
};

type Revenue = {
  id: string;
  business_id: string;
  appointment_id: string | null;
  amount: number;
  category: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
};

type TelegramSettings = {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  reminder_24h: boolean;
  reminder_2h: boolean;
  connected: boolean;
  last_test_sent_at: string | null;
};

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "user" | "admin" | "super_admin";
  blocked: boolean;
  created_at: string;
};

type AdminBusiness = {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  timezone: string;
  created_at: string;
};

type AdminSubscription = {
  id: string;
  business_id: string;
  plan: "free" | "pro" | "business";
  status: string;
  paddle_id: string | null;
  paddle_subscription_id?: string | null;
  paddle_customer_id?: string | null;
  paddle_price_id?: string | null;
  next_billed_at?: string | null;
};

type AdminActivity = {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const businessId = "test-business";

export function createTestBackend() {
  const state: {
    clients: Client[];
    services: Service[];
    appointments: Appointment[];
    revenues: Revenue[];
    expenses: Revenue[];
    telegramSettings: TelegramSettings;
    adminUsers: AdminUser[];
    adminBusinesses: AdminBusiness[];
    adminSubscriptions: AdminSubscription[];
    adminActivity: AdminActivity[];
  } = {
    clients: [
      {
        id: "client-1",
        business_id: businessId,
        name: "Алина Морозова",
        phone: "+996 700 123 456",
        email: "alina@example.com",
        notes: "VIP",
        telegram: "@alina",
        visits_count: 2,
        created_at: "2026-06-01T09:00:00Z"
      }
    ],
    services: [
      {
        id: "service-1",
        business_id: businessId,
        name: "Стрижка",
        category: "Основные",
        description: "Базовая услуга",
        price: 25,
        duration_minutes: 60,
        active: true,
        created_at: "2026-06-01T09:00:00Z"
      },
      {
        id: "service-2",
        business_id: businessId,
        name: "Архивная услуга",
        category: "Скрытые",
        description: null,
        price: 10,
        duration_minutes: 15,
        active: false,
        created_at: "2026-06-01T09:00:00Z"
      }
    ],
    appointments: [] as Appointment[],
    revenues: [] as Revenue[],
    expenses: [] as Revenue[],
    telegramSettings: {
      bot_token: "",
      chat_id: "",
      enabled: false,
      reminder_24h: true,
      reminder_2h: true,
      connected: false,
      last_test_sent_at: null
    },
    adminUsers: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        email: "root@businesshub.test",
        full_name: "Root Admin",
        role: "super_admin",
        blocked: false,
        created_at: "2026-06-01T09:00:00Z"
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        email: "owner@businesshub.test",
        full_name: "Business Owner",
        role: "user",
        blocked: false,
        created_at: "2026-06-02T09:00:00Z"
      }
    ],
    adminBusinesses: [
      {
        id: businessId,
        owner_id: "00000000-0000-0000-0000-000000000002",
        name: "QA Studio",
        type: "Барбершоп",
        timezone: "Asia/Bishkek",
        created_at: "2026-06-02T09:00:00Z"
      }
    ],
    adminSubscriptions: [
      {
        id: "subscription-1",
        business_id: businessId,
        plan: "free",
        status: "active",
        paddle_id: null,
        paddle_subscription_id: null,
        paddle_customer_id: null,
        paddle_price_id: null,
        next_billed_at: null
      }
    ],
    adminActivity: []
  };

  return state;
}

export async function mockCrudApi(page: Page, state = createTestBackend()) {
  await page.route(/\/api\/clients(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { data: state.clients, meta: { source: "e2e" } } });
      return;
    }

    const payload = request.postDataJSON() as Partial<Client> & { id?: string };
    if (request.method() === "POST") {
      if (state.adminSubscriptions[0]?.plan === "free" && state.clients.length >= 50) {
        await route.fulfill({
          status: 402,
          json: {
            error: "Достигнут лимит тарифа Free: 50 клиентов. Перейдите на Pro или Business, чтобы продолжить.",
            code: "PLAN_LIMIT_REACHED",
            upgradeRequired: true
          }
        });
        return;
      }

      const client: Client = {
        id: `client-${Date.now()}`,
        business_id: businessId,
        name: payload.name ?? "",
        phone: payload.phone ?? "",
        email: payload.email || null,
        notes: payload.notes || null,
        telegram: payload.telegram || null,
        visits_count: 0,
        created_at: new Date().toISOString()
      };
      state.clients = [client, ...state.clients];
      await route.fulfill({ status: 201, json: { data: client, meta: { source: "e2e" } } });
      return;
    }

    if (request.method() === "PATCH" && payload.id) {
      const existing = state.clients.find((client) => client.id === payload.id);
      if (!existing) {
        await route.fulfill({ status: 404, json: { error: "Client not found" } });
        return;
      }
      const updated = { ...existing, ...payload };
      state.clients = state.clients.map((client) => (client.id === updated.id ? updated : client));
      await route.fulfill({ json: { data: updated, meta: { source: "e2e" } } });
      return;
    }

    if (request.method() === "DELETE" && payload.id) {
      state.clients = state.clients.filter((client) => client.id !== payload.id);
      await route.fulfill({ json: { data: { id: payload.id }, meta: { source: "e2e" } } });
      return;
    }

    await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
  });

  await page.route("**/api/services", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { data: state.services, meta: { source: "e2e" } } });
      return;
    }

    const payload = request.postDataJSON() as Partial<Service> & { id?: string };
    if (request.method() === "POST") {
      const service: Service = {
        id: `service-${Date.now()}`,
        business_id: businessId,
        name: payload.name ?? "",
        category: payload.category ?? "",
        description: payload.description || null,
        price: Number(payload.price),
        duration_minutes: Number(payload.duration_minutes),
        active: Boolean(payload.active),
        created_at: new Date().toISOString()
      };
      state.services = [service, ...state.services];
      await route.fulfill({ status: 201, json: { data: service, meta: { source: "e2e" } } });
      return;
    }

    if (request.method() === "PATCH" && payload.id) {
      const existing = state.services.find((service) => service.id === payload.id);
      if (!existing) {
        await route.fulfill({ status: 404, json: { error: "Service not found" } });
        return;
      }
      const updated = { ...existing, ...payload };
      state.services = state.services.map((service) => (service.id === updated.id ? updated : service));
      await route.fulfill({ json: { data: updated, meta: { source: "e2e" } } });
      return;
    }

    if (request.method() === "DELETE" && payload.id) {
      state.services = state.services.filter((service) => service.id !== payload.id);
      await route.fulfill({ json: { data: { id: payload.id }, meta: { source: "e2e" } } });
      return;
    }

    await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
  });

  await page.route(/\/api\/appointments(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { data: state.appointments, meta: { source: "e2e" } } });
      return;
    }

    const payload = request.postDataJSON() as Partial<Appointment> & { id?: string; action?: "complete" | "cancel" | "no_show" };
    if (request.method() === "POST") {
      if (state.adminSubscriptions[0]?.plan === "free" && state.appointments.length >= 100) {
        await route.fulfill({
          status: 402,
          json: {
            error: "Достигнут лимит тарифа Free: 100 записей. Перейдите на Pro или Business, чтобы продолжить.",
            code: "PLAN_LIMIT_REACHED",
            upgradeRequired: true
          }
        });
        return;
      }

      const isConflict = state.appointments.some(
        (appointment) => appointment.starts_at === payload.starts_at && appointment.status === "scheduled"
      );
      if (isConflict && payload.status === "scheduled") {
        await route.fulfill({ status: 409, json: { error: "Это время уже занято. Выберите другое время." } });
        return;
      }

      const appointment: Appointment = {
        id: `appointment-${Date.now()}`,
        business_id: businessId,
        client_id: payload.client_id ?? "",
        service_id: payload.service_id ?? "",
        starts_at: payload.starts_at ?? "",
        ends_at: payload.ends_at ?? "",
        status: payload.status ?? "scheduled",
        notes: payload.notes || null,
        created_at: new Date().toISOString()
      };
      state.appointments = [...state.appointments, appointment];
      await route.fulfill({ status: 201, json: { data: appointment, meta: { source: "e2e" } } });
      return;
    }

    if (request.method() === "PATCH" && payload.id) {
      const existing = state.appointments.find((appointment) => appointment.id === payload.id);
      if (!existing) {
        await route.fulfill({ status: 404, json: { error: "Appointment not found" } });
        return;
      }

      if (payload.action) {
        if (payload.action === "complete") {
          if (existing.status === "completed" || state.revenues.some((revenue) => revenue.appointment_id === existing.id)) {
            await route.fulfill({ status: 409, json: { error: "Запись уже завершена. Доход уже создан." } });
            return;
          }

          const service = state.services.find((item) => item.id === existing.service_id);
          const updated = { ...existing, status: "completed" as const };
          state.appointments = state.appointments.map((appointment) => (appointment.id === updated.id ? updated : appointment));
          state.revenues = [
            ...state.revenues,
            {
              id: `revenue-${Date.now()}`,
              business_id: businessId,
              appointment_id: existing.id,
              amount: service?.price ?? 0,
              category: "Оплата за услугу",
              description: service ? `Оплата за услугу: ${service.name}` : "Оплата за услугу",
              occurred_at: existing.starts_at,
              created_at: new Date().toISOString()
            }
          ];
          await route.fulfill({ json: { data: updated, revenue: state.revenues.at(-1), meta: { source: "e2e" } } });
          return;
        }

        const updated = { ...existing, status: payload.action === "cancel" ? ("cancelled" as const) : ("no_show" as const) };
        state.appointments = state.appointments.map((appointment) => (appointment.id === updated.id ? updated : appointment));
        await route.fulfill({ json: { data: updated, meta: { source: "e2e" } } });
        return;
      }

      const updated = { ...existing, ...payload };
      state.appointments = state.appointments.map((appointment) => (appointment.id === updated.id ? updated : appointment));
      await route.fulfill({ json: { data: updated, meta: { source: "e2e" } } });
      return;
    }

    if (request.method() === "DELETE" && payload.id) {
      state.appointments = state.appointments.filter((appointment) => appointment.id !== payload.id);
      await route.fulfill({ json: { data: { id: payload.id }, meta: { source: "e2e" } } });
      return;
    }

    await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
  });

  await page.route("**/api/finance", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { data: { revenues: state.revenues, expenses: state.expenses }, meta: { source: "e2e" } } });
      return;
    }

    const payload = request.postDataJSON() as Partial<Revenue> & { id?: string; type?: "income" | "expense" };
    if (request.method() === "POST") {
      const operation: Revenue = {
        id: `${payload.type ?? "income"}-${Date.now()}`,
        business_id: businessId,
        appointment_id: null,
        amount: Number(payload.amount),
        category: payload.category ?? "",
        description: payload.description || null,
        occurred_at: payload.occurred_at ?? new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      if (payload.type === "expense") {
        state.expenses = [operation, ...state.expenses];
        await route.fulfill({ status: 201, json: { data: { ...operation, type: "expense" }, meta: { source: "e2e" } } });
      } else {
        state.revenues = [operation, ...state.revenues];
        await route.fulfill({ status: 201, json: { data: { ...operation, type: "income" }, meta: { source: "e2e" } } });
      }
      return;
    }

    await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
  });

  await page.route("**/api/billing/status", async (route) => {
    const subscription = state.adminSubscriptions[0];
    await route.fulfill({
      json: {
        data: {
          plan: subscription?.plan ?? "free",
          status: subscription?.status ?? "active",
          paddle_id: subscription?.paddle_id ?? null,
          paddle_subscription_id: subscription?.paddle_subscription_id ?? null,
          paddle_customer_id: subscription?.paddle_customer_id ?? null,
          paddle_price_id: subscription?.paddle_price_id ?? null,
          next_billed_at: subscription?.next_billed_at ?? null,
          trial_ends_at: null,
          cancelled_at: null,
          portal_url: null
        }
      }
    });
  });

  await page.route("**/api/billing/subscription", async (route) => {
    const subscription = state.adminSubscriptions[0];
    await route.fulfill({
      json: {
        data: {
          plan: subscription?.plan ?? "free",
          status: subscription?.status ?? "active",
          paddle_id: subscription?.paddle_id ?? null,
          paddle_subscription_id: subscription?.paddle_subscription_id ?? null,
          paddle_customer_id: subscription?.paddle_customer_id ?? null,
          paddle_price_id: subscription?.paddle_price_id ?? null,
          next_billed_at: subscription?.next_billed_at ?? null,
          trial_ends_at: null,
          cancelled_at: null,
          portal_url: null
        }
      }
    });
  });

  await page.route("**/api/billing/checkout", async (route) => {
    const payload = route.request().postDataJSON() as { plan: "free" | "pro" | "business" };
    if (payload.plan === "free") {
      await route.fulfill({ status: 400, json: { error: "Free plan does not require checkout" } });
      return;
    }

    await route.fulfill({
      json: {
        data: {
          plan: payload.plan,
          priceId: payload.plan === "pro" ? "pri_pro_test" : "pri_business_test",
          transactionId: payload.plan === "pro" ? "txn_pro_test" : "txn_business_test",
          checkoutUrl: "https://checkout.paddle.com/test",
          clientToken: "test_client_token",
          environment: "sandbox",
          customerEmail: "owner@businesshub.test",
          customData: { business_id: businessId, plan: payload.plan },
          checkoutMode: "paddle-js",
          successUrl: "http://localhost:3000/billing?checkout=success"
        }
      }
    });
  });

  await page.route("**/api/billing/portal", async (route) => {
    await route.fulfill({
      json: {
        data: {
          url: "https://sandbox.customer-portal.paddle.com/session/test"
        }
      }
    });
  });

  await page.route("**/api/billing/webhook", async (route) => {
    const payload = route.request().postDataJSON() as {
      eventType?: string;
      data?: {
        business_id?: string;
        subscription_id?: string;
        customer_id?: string;
        price_id?: string;
        status?: string;
      };
    };
    const eventType = payload.eventType ?? "subscription.updated";
    if (eventType.startsWith("subscription.")) {
      const plan = payload.data?.price_id === "pri_business_test" ? "business" : payload.data?.price_id === "pri_pro_test" ? "pro" : "free";
      state.adminSubscriptions[0] = {
        ...(state.adminSubscriptions[0] ?? { id: "subscription-1", business_id: businessId, paddle_id: null, status: "active", plan: "free" }),
        plan: eventType === "subscription.canceled" ? "free" : plan,
        status: eventType === "subscription.canceled" ? "canceled" : (payload.data?.status ?? "active"),
        paddle_id: payload.data?.subscription_id ?? "sub_test",
        paddle_subscription_id: payload.data?.subscription_id ?? "sub_test",
        paddle_customer_id: payload.data?.customer_id ?? "ctm_test",
        paddle_price_id: payload.data?.price_id ?? "pri_pro_test",
        next_billed_at: "2026-07-05T00:00:00Z"
      };
    }
    await route.fulfill({ json: { received: true, eventType } });
  });

  await page.route("**/api/telegram", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { data: state.telegramSettings, meta: { source: "e2e" } } });
      return;
    }

    const payload = request.postDataJSON() as
      | { action: "save"; settings: TelegramSettings }
      | { action: "test_token"; bot_token?: string }
      | { action: "send_test"; bot_token?: string; chat_id?: string };

    if (request.method() === "POST" && payload.action === "test_token") {
      if (!payload.bot_token) {
        await route.fulfill({ status: 422, json: { error: "Bot Token is required" } });
        return;
      }
      if (payload.bot_token === "bad") {
        await route.fulfill({ status: 502, json: { error: "Telegram API: Unauthorized" } });
        return;
      }
      await route.fulfill({ json: { data: { username: "businesshub_test_bot" }, meta: { source: "e2e" } } });
      return;
    }

    if (request.method() === "POST" && payload.action === "send_test") {
      if (!payload.bot_token || !payload.chat_id) {
        await route.fulfill({ status: 422, json: { error: "Bot Token and Chat ID are required" } });
        return;
      }
      state.telegramSettings = {
        ...state.telegramSettings,
        bot_token: payload.bot_token,
        chat_id: payload.chat_id,
        connected: true,
        last_test_sent_at: new Date().toISOString()
      };
      await route.fulfill({ json: { data: state.telegramSettings, meta: { source: "e2e" } } });
      return;
    }

    if (request.method() === "POST" && payload.action === "save") {
      state.telegramSettings = {
        ...state.telegramSettings,
        ...payload.settings,
        connected: true
      };
      await route.fulfill({ json: { data: state.telegramSettings, meta: { source: "e2e" } } });
      return;
    }

    await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
  });

  await page.route("**/api/admin/users", async (route) => {
    if (route.request().headers()["x-businesshub-e2e-role"] === "user") {
      await route.fulfill({ status: 403, json: { error: "Forbidden" } });
      return;
    }
    await route.fulfill({ json: { data: state.adminUsers } });
  });

  await page.route("**/api/admin/businesses", async (route) => {
    if (route.request().headers()["x-businesshub-e2e-role"] === "user") {
      await route.fulfill({ status: 403, json: { error: "Forbidden" } });
      return;
    }
    await route.fulfill({ json: { data: state.adminBusinesses } });
  });

  await page.route("**/api/admin/subscriptions", async (route) => {
    if (route.request().headers()["x-businesshub-e2e-role"] === "user") {
      await route.fulfill({ status: 403, json: { error: "Forbidden" } });
      return;
    }
    await route.fulfill({ json: { data: state.adminSubscriptions } });
  });

  await page.route("**/api/admin/revenue", async (route) => {
    if (route.request().headers()["x-businesshub-e2e-role"] === "user") {
      await route.fulfill({ status: 403, json: { error: "Forbidden" } });
      return;
    }
    await route.fulfill({ json: { data: { total: 200, currency: "USD", payments: [] } } });
  });

  await page.route("**/api/admin/activity", async (route) => {
    if (route.request().headers()["x-businesshub-e2e-role"] === "user") {
      await route.fulfill({ status: 403, json: { error: "Forbidden" } });
      return;
    }
    await route.fulfill({ json: { data: state.adminActivity } });
  });

  await page.route("**/api/admin/block-user", async (route) => {
    const payload = route.request().postDataJSON() as { userId: string };
    const user = state.adminUsers.find((item) => item.id === payload.userId);
    if (!user) {
      await route.fulfill({ status: 404, json: { error: "User not found" } });
      return;
    }
    user.blocked = true;
    state.adminActivity.unshift({
      id: `activity-${Date.now()}`,
      actor_id: "00000000-0000-0000-0000-000000000001",
      target_user_id: user.id,
      action: "block_user",
      metadata: { email: user.email },
      created_at: new Date().toISOString()
    });
    await route.fulfill({ json: { data: user } });
  });

  await page.route("**/api/admin/unblock-user", async (route) => {
    const payload = route.request().postDataJSON() as { userId: string };
    const user = state.adminUsers.find((item) => item.id === payload.userId);
    if (!user) {
      await route.fulfill({ status: 404, json: { error: "User not found" } });
      return;
    }
    user.blocked = false;
    state.adminActivity.unshift({
      id: `activity-${Date.now()}`,
      actor_id: "00000000-0000-0000-0000-000000000001",
      target_user_id: user.id,
      action: "unblock_user",
      metadata: { email: user.email },
      created_at: new Date().toISOString()
    });
    await route.fulfill({ json: { data: user } });
  });

  await page.route("**/api/admin/change-plan", async (route) => {
    const payload = route.request().postDataJSON() as { userId: string; plan: AdminSubscription["plan"] };
    const business = state.adminBusinesses.find((item) => item.owner_id === payload.userId);
    if (!business) {
      await route.fulfill({ status: 404, json: { error: "Business not found for user" } });
      return;
    }
    const subscription = state.adminSubscriptions.find((item) => item.business_id === business.id);
    if (subscription) {
      subscription.plan = payload.plan;
      subscription.status = "active";
    }
    const saved = subscription ?? {
      id: `subscription-${Date.now()}`,
      business_id: business.id,
      plan: payload.plan,
      status: "active",
      paddle_id: null,
      paddle_subscription_id: null,
      paddle_customer_id: null,
      paddle_price_id: null,
      next_billed_at: null
    };
    if (!subscription) {
      state.adminSubscriptions.unshift(saved);
    }
    state.adminActivity.unshift({
      id: `activity-${Date.now()}`,
      actor_id: "00000000-0000-0000-0000-000000000001",
      target_user_id: payload.userId,
      action: "change_plan",
      metadata: { plan: payload.plan },
      created_at: new Date().toISOString()
    });
    await route.fulfill({ json: { data: saved } });
  });

  return state;
}

export async function authenticateE2E(page: Page, role?: "user" | "super_admin") {
  await page.setExtraHTTPHeaders({
    "x-businesshub-e2e-auth": "1",
    ...(role ? { "x-businesshub-e2e-role": role } : {})
  });
}

export async function expectNoAppErrors(page: Page) {
  await expect(page.locator("body")).not.toContainText("Unhandled Runtime Error");
  await expect(page.locator("body")).not.toContainText("Application error");
}
