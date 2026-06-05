import { headers } from "next/headers";
import { getSupabaseServerEnvStatus } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Appointment, Client, Database, Service } from "@/types/database";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type MoneyRow = Database["public"]["Tables"]["revenues"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];

export type RevenuePoint = {
  month: string;
  revenue: number;
  profit: number;
};

export type ActivityItem = {
  id: string;
  type: "client" | "service" | "appointment";
  label: string;
  createdAt: string;
};

export type FinanceRevenueItem = {
  id: string;
  appointmentId: string | null;
  title: string;
  clientName: string;
  serviceName: string;
  occurredAt: string;
  amount: number;
};

export type BusinessDataError = {
  error: string;
  status: number;
  missingEnv?: readonly string[];
  placeholderEnv?: readonly string[];
  invalidEnv?: readonly string[];
};

type BusinessContext =
  | { supabase: SupabaseClient; businessId: string; e2e: false }
  | { supabase: null; businessId: "e2e-business"; e2e: true };

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "short" });

async function isE2EBypassRequest() {
  if (process.env.E2E_AUTH_BYPASS !== "true") {
    return false;
  }

  const headerStore = await headers();
  return headerStore.get("x-businesshub-e2e-auth") === "1";
}

function emptyContext(): BusinessContext {
  return { supabase: null, businessId: "e2e-business", e2e: true };
}

export async function getBusinessContext(): Promise<{ context: BusinessContext; error: null } | { context: null; error: BusinessDataError }> {
  if (await isE2EBypassRequest()) {
    return { context: emptyContext(), error: null };
  }

  const envStatus = getSupabaseServerEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
    return {
      context: null,
      error: {
        error: "Supabase is not configured",
        status: 503,
        missingEnv: envStatus.missingEnv,
        placeholderEnv: envStatus.placeholderEnv,
        invalidEnv: envStatus.invalidEnv
      }
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { context: null, error: { error: "Unauthorized", status: 401 } };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (businessError) {
    console.error("[business-context.business]", { message: businessError.message });
    return { context: null, error: { error: "Failed to load business workspace", status: 500 } };
  }

  const businessRow = business as { id: string } | null;
  if (!businessRow) {
    return { context: null, error: { error: "Business workspace not found", status: 404 } };
  }

  return { context: { supabase, businessId: businessRow.id, e2e: false }, error: null };
}

function sumMoney(rows: Array<Pick<MoneyRow, "amount"> | Pick<ExpenseRow, "amount">>) {
  return rows.reduce((total, row) => total + Number(row.amount), 0);
}

function createMonthSeries(revenues: MoneyRow[], expenses: ExpenseRow[]): RevenuePoint[] {
  const buckets = new Map<string, RevenuePoint>();

  for (const row of revenues) {
    const date = new Date(row.occurred_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = buckets.get(key) ?? { month: monthFormatter.format(date), revenue: 0, profit: 0 };
    current.revenue += Number(row.amount);
    current.profit += Number(row.amount);
    buckets.set(key, current);
  }

  for (const row of expenses) {
    const date = new Date(row.occurred_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = buckets.get(key) ?? { month: monthFormatter.format(date), revenue: 0, profit: 0 };
    current.profit -= Number(row.amount);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function getDateRange() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    todayStart: todayStart.toISOString(),
    todayEnd: todayEnd.toISOString(),
    monthStart: monthStart.toISOString()
  };
}

export async function getDashboardData() {
  const { context, error } = await getBusinessContext();
  if (error) return { error };

  if (context.e2e) {
    return {
      error: null,
      data: {
        clients: [] as Client[],
        clientsCount: 0,
        services: [] as Service[],
        todayAppointments: [] as Appointment[],
        todayRevenue: 0,
        monthRevenue: 0,
        activity: [
          { id: "e2e-activity-1", type: "appointment", label: "Запись на 09:00", createdAt: "2026-06-04T09:00:00Z" },
          { id: "e2e-activity-2", type: "appointment", label: "Запись на 09:00", createdAt: "2026-06-04T09:00:00Z" }
        ] as ActivityItem[],
        revenueSeries: [] as RevenuePoint[]
      }
    };
  }

  const { todayStart, todayEnd, monthStart } = getDateRange();
  const [clientsCountResult, clientsResult, servicesResult, appointmentsResult, todayRevenueResult, monthRevenueResult, monthExpensesResult] =
    await Promise.all([
      context.supabase.from("clients").select("id", { count: "exact", head: true }).eq("business_id", context.businessId),
      context.supabase.from("clients").select("id, name, created_at").eq("business_id", context.businessId).order("created_at", { ascending: false }).limit(4),
      context.supabase.from("services").select("id, name, created_at").eq("business_id", context.businessId).order("created_at", { ascending: false }).limit(4),
      context.supabase
        .from("appointments")
        .select("*")
        .eq("business_id", context.businessId)
        .gte("starts_at", todayStart)
        .lte("starts_at", todayEnd)
        .order("starts_at", { ascending: true }),
      context.supabase
        .from("revenues")
        .select("*")
        .eq("business_id", context.businessId)
        .gte("occurred_at", todayStart)
        .lte("occurred_at", todayEnd),
      context.supabase.from("revenues").select("*").eq("business_id", context.businessId).gte("occurred_at", monthStart),
      context.supabase.from("expenses").select("*").eq("business_id", context.businessId).gte("occurred_at", monthStart)
    ]);

  const failed = [clientsCountResult, clientsResult, servicesResult, appointmentsResult, todayRevenueResult, monthRevenueResult, monthExpensesResult].find(
    (result) => result.error
  );
  if (failed?.error) {
    console.error("[dashboard.data]", { message: failed.error.message });
    return { error: { error: "Failed to load dashboard data", status: 500 } };
  }

  const clients = (clientsResult.data ?? []) as Pick<Client, "id" | "name" | "created_at">[];
  const services = (servicesResult.data ?? []) as Pick<Service, "id" | "name" | "created_at">[];
  const todayAppointments = (appointmentsResult.data ?? []) as Appointment[];
  const todayRevenues = (todayRevenueResult.data ?? []) as MoneyRow[];
  const monthRevenues = (monthRevenueResult.data ?? []) as MoneyRow[];
  const monthExpenses = (monthExpensesResult.data ?? []) as ExpenseRow[];
  const activity: ActivityItem[] = [
    ...clients.slice(0, 2).map((client) => ({
      id: `client-${client.id}`,
      type: "client" as const,
      label: `Создан клиент: ${client.name}`,
      createdAt: client.created_at
    })),
    ...services.slice(0, 2).map((service) => ({
      id: `service-${service.id}`,
      type: "service" as const,
      label: `Создана услуга: ${service.name}`,
      createdAt: service.created_at
    })),
    ...todayAppointments.slice(0, 2).map((appointment) => ({
      id: `appointment-${appointment.id}`,
      type: "appointment" as const,
      label: `Запись на ${new Date(appointment.starts_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
      createdAt: appointment.created_at
    }))
  ].slice(0, 4);

  return {
    error: null,
    data: {
      clients,
      clientsCount: clientsCountResult.count ?? clients.length,
      services,
      todayAppointments,
      todayRevenue: sumMoney(todayRevenues),
      monthRevenue: sumMoney(monthRevenues),
      activity,
      revenueSeries: createMonthSeries(monthRevenues, monthExpenses)
    }
  };
}

export async function getFinanceData() {
  const { context, error } = await getBusinessContext();
  if (error) return { error };

  if (context.e2e) {
    return {
      error: null,
      data: {
        revenues: [] as MoneyRow[],
        expenses: [] as ExpenseRow[],
        revenueItems: [] as FinanceRevenueItem[],
        revenue: 0,
        expensesTotal: 0,
        profit: 0,
        revenueSeries: [] as RevenuePoint[]
      }
    };
  }

  const [revenuesResult, expensesResult, appointmentsResult, clientsResult, servicesResult] = await Promise.all([
    context.supabase.from("revenues").select("*").eq("business_id", context.businessId).order("occurred_at", { ascending: true }),
    context.supabase.from("expenses").select("*").eq("business_id", context.businessId).order("occurred_at", { ascending: true }),
    context.supabase.from("appointments").select("*").eq("business_id", context.businessId),
    context.supabase.from("clients").select("*").eq("business_id", context.businessId),
    context.supabase.from("services").select("*").eq("business_id", context.businessId)
  ]);

  const failed = [revenuesResult, expensesResult, appointmentsResult, clientsResult, servicesResult].find((result) => result.error);
  if (failed?.error) {
    console.error("[finance.data]", { message: failed.error.message });
    return { error: { error: "Failed to load finance data", status: 500 } };
  }

  const revenues = (revenuesResult.data ?? []) as MoneyRow[];
  const expenses = (expensesResult.data ?? []) as ExpenseRow[];
  const appointments = (appointmentsResult.data ?? []) as Appointment[];
  const clients = (clientsResult.data ?? []) as Client[];
  const services = (servicesResult.data ?? []) as Service[];
  const revenueItems = revenues.map((row) => {
    const appointment = row.appointment_id ? appointments.find((item) => item.id === row.appointment_id) : undefined;
    const client = appointment ? clients.find((item) => item.id === appointment.client_id) : undefined;
    const service = appointment ? services.find((item) => item.id === appointment.service_id) : undefined;

    return {
      id: row.id,
      appointmentId: row.appointment_id,
      title: row.category,
      clientName: client?.name ?? "—",
      serviceName: service?.name ?? row.description ?? "—",
      occurredAt: row.occurred_at,
      amount: Number(row.amount)
    };
  });
  const revenue = sumMoney(revenues);
  const expensesTotal = sumMoney(expenses);

  return {
    error: null,
    data: {
      revenues,
      expenses,
      revenueItems,
      revenue,
      expensesTotal,
      profit: revenue - expensesTotal,
      revenueSeries: createMonthSeries(revenues, expenses)
    }
  };
}

export async function getAnalyticsData() {
  const { context, error } = await getBusinessContext();
  if (error) return { error };

  if (context.e2e) {
    return {
      error: null,
      data: {
        newClients: 0,
        repeatClientsRate: 0,
        topService: "—",
        bookingConversion: 0,
        revenueSeries: [] as RevenuePoint[],
        topServices: [] as string[]
      }
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [clientsResult, appointmentsResult, servicesResult, revenuesResult, expensesResult] = await Promise.all([
    context.supabase.from("clients").select("*").eq("business_id", context.businessId),
    context.supabase.from("appointments").select("*").eq("business_id", context.businessId),
    context.supabase.from("services").select("*").eq("business_id", context.businessId),
    context.supabase.from("revenues").select("*").eq("business_id", context.businessId).order("occurred_at", { ascending: true }),
    context.supabase.from("expenses").select("*").eq("business_id", context.businessId).order("occurred_at", { ascending: true })
  ]);

  const failed = [clientsResult, appointmentsResult, servicesResult, revenuesResult, expensesResult].find((result) => result.error);
  if (failed?.error) {
    console.error("[analytics.data]", { message: failed.error.message });
    return { error: { error: "Failed to load analytics data", status: 500 } };
  }

  const clients = (clientsResult.data ?? []) as Client[];
  const appointments = (appointmentsResult.data ?? []) as Appointment[];
  const services = (servicesResult.data ?? []) as Service[];
  const revenues = (revenuesResult.data ?? []) as MoneyRow[];
  const expenses = (expensesResult.data ?? []) as ExpenseRow[];
  const newClients = clients.filter((client) => new Date(client.created_at) >= thirtyDaysAgo).length;
  const repeatClientsRate = clients.length
    ? Math.round((clients.filter((client) => client.visits_count > 1).length / clients.length) * 100)
    : 0;
  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed").length;
  const bookingConversion = appointments.length ? Math.round((completedAppointments / appointments.length) * 100) : 0;
  const serviceRevenue = new Map<string, number>();

  for (const revenue of revenues) {
    serviceRevenue.set(revenue.category, (serviceRevenue.get(revenue.category) ?? 0) + Number(revenue.amount));
  }

  const topServices = Array.from(serviceRevenue.entries())
    .sort(([, left], [, right]) => right - left)
    .map(([category]) => category);
  const topService = topServices[0] ?? services.find((service) => service.active)?.name ?? "—";

  return {
    error: null,
    data: {
      newClients,
      repeatClientsRate,
      topService,
      bookingConversion,
      revenueSeries: createMonthSeries(revenues, expenses),
      topServices
    }
  };
}
