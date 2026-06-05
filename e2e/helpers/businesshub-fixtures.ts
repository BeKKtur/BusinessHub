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
  status: "scheduled" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
};

const businessId = "test-business";

export function createTestBackend() {
  const state: { clients: Client[]; services: Service[]; appointments: Appointment[] } = {
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
    appointments: [] as Appointment[]
  };

  return state;
}

export async function mockCrudApi(page: Page, state = createTestBackend()) {
  await page.route("**/api/clients", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { data: state.clients, meta: { source: "e2e" } } });
      return;
    }

    const payload = request.postDataJSON() as Partial<Client> & { id?: string };
    if (request.method() === "POST") {
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

  await page.route("**/api/appointments", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { data: state.appointments, meta: { source: "e2e" } } });
      return;
    }

    const payload = request.postDataJSON() as Partial<Appointment> & { id?: string };
    if (request.method() === "POST") {
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

  return state;
}

export async function expectNoAppErrors(page: Page) {
  await expect(page.locator("body")).not.toContainText("Unhandled Runtime Error");
  await expect(page.locator("body")).not.toContainText("Application error");
}
