import { NextResponse } from "next/server";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { enforcePlanLimit, getBusinessSubscription } from "@/lib/server/billing";
import { formatLimit, planDetails } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { appointmentDeleteSchema, appointmentSchema, appointmentStatusActionSchema, appointmentUpdateSchema } from "@/lib/validators";
import type { Appointment, AppointmentStatus, Client, Revenue, Service } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type AppointmentInsert = Omit<Appointment, "id" | "created_at" | "usage_counted_at">;
type AppointmentUpdate = Partial<Omit<Appointment, "id" | "business_id" | "created_at" | "usage_counted_at">>;
type AppointmentConflictRow = Pick<Appointment, "id">;
type ServiceStatusRow = { id: string; active: boolean; name?: string; price?: number };
type ClientExistsRow = Pick<Client, "id" | "served_counted_at">;
type AppointmentDetailsRow = Appointment;
type RevenueInsert = Omit<Revenue, "id" | "created_at">;
type AppointmentClientDetails = Pick<Client, "id" | "name" | "phone" | "email">;
type AppointmentServiceDetails = Pick<Service, "id" | "name" | "price" | "duration_minutes">;
type AppointmentWithDetails = Appointment & {
  client: AppointmentClientDetails | null;
  service: AppointmentServiceDetails | null;
};
type UsageCounterResult = {
  served_client_counted: boolean;
  completed_appointment_counted: boolean;
};
type UsageRpcClient = {
  rpc: (
    functionName: "record_completed_appointment_usage",
    args: { p_business_id: string; p_appointment_id: string; p_client_id: string }
  ) => Promise<QueryResult<UsageCounterResult[]>>;
};

type BusinessesTable = {
  select: (columns: string) => {
    eq: (column: "owner_id", value: string) => {
      limit: (count: number) => {
        single: () => Promise<QueryResult<{ id: string }>>;
      };
    };
  };
};

type AppointmentsTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      gte: (column: "starts_at", value: string) => {
        lte: (column: "starts_at", value: string) => {
          order: (column: "starts_at", options: { ascending: boolean }) => Promise<QueryResult<Appointment[]>>;
        };
      };
    };
  };
  insert: (payload: AppointmentInsert) => {
    select: (columns: string) => {
      single: () => Promise<QueryResult<Appointment>>;
    };
  };
  update: (payload: AppointmentUpdate) => {
    eq: (column: "id", value: string) => {
      eq: (column: "business_id", value: string) => {
        select: (columns: string) => {
          single: () => Promise<QueryResult<Appointment>>;
        };
      };
    };
  };
  delete: () => {
    eq: (column: "id", value: string) => {
      eq: (column: "business_id", value: string) => Promise<QueryResult<null>>;
    };
  };
};

type AppointmentDetailsTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      eq: (column: "id", value: string) => {
        limit: (count: number) => {
          single: () => Promise<QueryResult<AppointmentDetailsRow>>;
        };
      };
    };
  };
};

type AppointmentConflictsTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      eq: (column: "starts_at", value: string) => {
        eq: (column: "status", value: "scheduled") => Promise<QueryResult<AppointmentConflictRow[]>>;
      };
    };
  };
};

type ServicesStatusTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      eq: (column: "id", value: string) => {
        limit: (count: number) => Promise<QueryResult<ServiceStatusRow[]>>;
      };
    };
  };
};

type RevenuesTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      eq: (column: "appointment_id", value: string) => {
        limit: (count: number) => Promise<QueryResult<Pick<Revenue, "id">[]>>;
      };
    };
  };
  insert: (payload: RevenueInsert) => {
    select: (columns: string) => {
      single: () => Promise<QueryResult<Revenue>>;
    };
  };
};

type ClientsStatusTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      eq: (column: "id", value: string) => {
        limit: (count: number) => Promise<QueryResult<ClientExistsRow[]>>;
      };
    };
  };
};

type ClientsLookupTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      in: (column: "id", values: string[]) => Promise<QueryResult<AppointmentClientDetails[]>>;
    };
  };
};

type ServicesLookupTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      in: (column: "id", values: string[]) => Promise<QueryResult<AppointmentServiceDetails[]>>;
    };
  };
};

function businessesTable(supabase: SupabaseServerClient) {
  return supabase.from("businesses") as unknown as BusinessesTable;
}

function appointmentsTable(supabase: SupabaseServerClient) {
  return supabase.from("appointments") as unknown as AppointmentsTable;
}

function appointmentDetailsTable(supabase: SupabaseServerClient) {
  return supabase.from("appointments") as unknown as AppointmentDetailsTable;
}

function appointmentConflictsTable(supabase: SupabaseServerClient) {
  return supabase.from("appointments") as unknown as AppointmentConflictsTable;
}

function servicesStatusTable(supabase: SupabaseServerClient) {
  return supabase.from("services") as unknown as ServicesStatusTable;
}

function revenuesTable(supabase: SupabaseServerClient) {
  return supabase.from("revenues") as unknown as RevenuesTable;
}

function clientsStatusTable(supabase: SupabaseServerClient) {
  return supabase.from("clients") as unknown as ClientsStatusTable;
}

function clientsLookupTable(supabase: SupabaseServerClient) {
  return supabase.from("clients") as unknown as ClientsLookupTable;
}

function servicesLookupTable(supabase: SupabaseServerClient) {
  return supabase.from("services") as unknown as ServicesLookupTable;
}

function usageRpcClient(supabase: SupabaseServerClient) {
  return supabase as unknown as UsageRpcClient;
}

function isMissingRevenueAppointmentLink(error: QueryError) {
  return /appointment_id|schema cache|column/i.test(error.message);
}

function revenueAppointmentLinkError() {
  return NextResponse.json(
    {
      error:
        "В базе не настроена связь дохода с записью. Примените migration supabase/migrations/007_ensure_revenue_appointment_link.sql."
    },
    { status: 503 }
  );
}

async function getSupabaseContext() {
  const envStatus = getSupabaseEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
    return { error: supabaseConfigErrorResponse() };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: business, error: businessError } = await businessesTable(supabase)
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();

  if (businessError || !business) {
    return { error: NextResponse.json({ error: "Business workspace not found" }, { status: 404 }) };
  }

  return { supabase, businessId: business.id };
}

async function ensureActiveService(context: { supabase: SupabaseServerClient; businessId: string }, serviceId: string) {
  const { data, error } = await servicesStatusTable(context.supabase)
    .select("id, active")
    .eq("business_id", context.businessId)
    .eq("id", serviceId)
    .limit(1);

  if (error || !data?.length) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (!data[0].active) {
    return NextResponse.json({ error: "Inactive services cannot be used for appointments" }, { status: 422 });
  }

  return null;
}

async function getServiceForRevenue(context: { supabase: SupabaseServerClient; businessId: string }, serviceId: string) {
  const { data, error } = await servicesStatusTable(context.supabase)
    .select("id, active, name, price")
    .eq("business_id", context.businessId)
    .eq("id", serviceId)
    .limit(1);

  if (error || !data?.length) {
    return { error: NextResponse.json({ error: "Service not found" }, { status: 404 }) };
  }

  return { service: data[0] };
}

async function ensureClientExists(context: { supabase: SupabaseServerClient; businessId: string }, clientId: string) {
  const { data, error } = await clientsStatusTable(context.supabase)
    .select("id, served_counted_at")
    .eq("business_id", context.businessId)
    .eq("id", clientId)
    .limit(1);

  if (error || !data?.length) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return null;
}

async function getClientUsageStatus(context: { supabase: SupabaseServerClient; businessId: string }, clientId: string) {
  const { data, error } = await clientsStatusTable(context.supabase)
    .select("id, served_counted_at")
    .eq("business_id", context.businessId)
    .eq("id", clientId)
    .limit(1);

  if (error || !data?.length) {
    return { error: NextResponse.json({ error: "Client not found" }, { status: 404 }) };
  }

  return { client: data[0] };
}

async function ensureCompletionLimitAvailable(
  context: { supabase: SupabaseServerClient; businessId: string },
  options: { clientId: string; appointmentUsageCountedAt?: string | null }
) {
  const subscription = await getBusinessSubscription(context.supabase, context.businessId);
  const limits = planDetails[subscription.plan];
  const appointmentLimit = limits.appointmentLimit;
  const clientLimit = limits.clientLimit;

  if (
    appointmentLimit !== "unlimited" &&
    !options.appointmentUsageCountedAt &&
    subscription.completed_appointments_count >= appointmentLimit
  ) {
    return NextResponse.json(
      {
        error: `Достигнут лимит тарифа ${limits.label}: ${formatLimit(appointmentLimit)} завершённых записей. Перейдите на более высокий тариф, чтобы продолжить.`,
        code: "PLAN_LIMIT_REACHED",
        upgradeRequired: true,
        plan: subscription.plan,
        limit: appointmentLimit,
        currentCount: subscription.completed_appointments_count
      },
      { status: 402 }
    );
  }

  if (clientLimit === "unlimited") {
    return null;
  }

  const clientResult = await getClientUsageStatus(context, options.clientId);
  if (clientResult.error) return clientResult.error;

  if (!clientResult.client.served_counted_at && subscription.served_clients_count >= clientLimit) {
    return NextResponse.json(
      {
        error: `Достигнут лимит тарифа ${limits.label}: ${formatLimit(clientLimit)} обслуженных клиентов. Перейдите на более высокий тариф, чтобы продолжить.`,
        code: "PLAN_LIMIT_REACHED",
        upgradeRequired: true,
        plan: subscription.plan,
        limit: clientLimit,
        currentCount: subscription.served_clients_count
      },
      { status: 402 }
    );
  }

  return null;
}

async function hydrateAppointments(
  context: { supabase: SupabaseServerClient; businessId: string },
  appointments: Appointment[]
): Promise<AppointmentWithDetails[]> {
  const clientIds = Array.from(new Set(appointments.map((appointment) => appointment.client_id).filter(Boolean)));
  const serviceIds = Array.from(new Set(appointments.map((appointment) => appointment.service_id).filter(Boolean)));

  const [clientsResult, servicesResult] = await Promise.all([
    clientIds.length
      ? clientsLookupTable(context.supabase)
          .select("id, name, phone, email")
          .eq("business_id", context.businessId)
          .in("id", clientIds)
      : Promise.resolve({ data: [], error: null } as QueryResult<AppointmentClientDetails[]>),
    serviceIds.length
      ? servicesLookupTable(context.supabase)
          .select("id, name, price, duration_minutes")
          .eq("business_id", context.businessId)
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null } as QueryResult<AppointmentServiceDetails[]>)
  ]);

  if (clientsResult.error) {
    console.error("[appointments.hydrate.clients]", { message: clientsResult.error.message });
  }

  if (servicesResult.error) {
    console.error("[appointments.hydrate.services]", { message: servicesResult.error.message });
  }

  const clientsById = new Map((clientsResult.data ?? []).map((client) => [client.id, client]));
  const servicesById = new Map((servicesResult.data ?? []).map((service) => [service.id, service]));

  return appointments.map((appointment) => ({
    ...appointment,
    client: clientsById.get(appointment.client_id) ?? null,
    service: servicesById.get(appointment.service_id) ?? null
  }));
}

async function ensureTimeAvailable(
  context: { supabase: SupabaseServerClient; businessId: string },
  startsAt: string,
  currentAppointmentId?: string
) {
  const { data, error } = await appointmentConflictsTable(context.supabase)
    .select("id")
    .eq("business_id", context.businessId)
    .eq("starts_at", startsAt)
    .eq("status", "scheduled");

  if (error) {
    return NextResponse.json({ error: "Failed to check appointment availability" }, { status: 500 });
  }

  const hasConflict = (data ?? []).some((appointment) => appointment.id !== currentAppointmentId);
  if (hasConflict) {
    return NextResponse.json({ error: "Это время уже занято. Выберите другое время." }, { status: 409 });
  }

  return null;
}

async function createCompletionSideEffects(
  context: { supabase: SupabaseServerClient; businessId: string },
  appointment: Appointment
) {
  const serviceResult = await getServiceForRevenue(context, appointment.service_id);
  if (serviceResult.error) return { error: serviceResult.error };

  const { data: existingRevenue, error: existingRevenueError } = await revenuesTable(context.supabase)
    .select("id")
    .eq("business_id", context.businessId)
    .eq("appointment_id", appointment.id)
    .limit(1);

  if (existingRevenueError) {
    console.error("[appointments.status.revenueCheck]", { message: existingRevenueError.message });
    if (isMissingRevenueAppointmentLink(existingRevenueError)) {
      return { error: revenueAppointmentLinkError() };
    }

    return { error: NextResponse.json({ error: "Failed to check appointment revenue" }, { status: 500 }) };
  }

  const { error: usageError } = await usageRpcClient(context.supabase).rpc("record_completed_appointment_usage", {
    p_business_id: context.businessId,
    p_appointment_id: appointment.id,
    p_client_id: appointment.client_id
  });

  if (usageError) {
    console.error("[appointments.status.usage]", { message: usageError.message });
    if (/limit reached/i.test(usageError.message)) {
      return {
        error: NextResponse.json(
          {
            error: "Достигнут лимит тарифа. Перейдите на более высокий тариф, чтобы продолжить.",
            code: "PLAN_LIMIT_REACHED",
            upgradeRequired: true
          },
          { status: 402 }
        )
      };
    }

    return {
      error: NextResponse.json(
        {
          error:
            "Не удалось обновить лимиты тарифа. Примените migration supabase/migrations/016_persistent_usage_limits.sql и повторите действие."
        },
        { status: 503 }
      )
    };
  }

  if (existingRevenue?.length) {
    return { revenue: null };
  }

  const { data: revenue, error: revenueError } = await revenuesTable(context.supabase)
    .insert({
      business_id: context.businessId,
      appointment_id: appointment.id,
      amount: Number(serviceResult.service.price ?? 0),
      category: "Оплата за услугу",
      description: serviceResult.service.name ? `Оплата за услугу: ${serviceResult.service.name}` : "Оплата за услугу",
      occurred_at: appointment.starts_at
    })
    .select("*")
    .single();

  if (revenueError || !revenue) {
    console.error("[appointments.status.revenue]", { message: revenueError?.message ?? "No revenue returned" });
    if (revenueError && isMissingRevenueAppointmentLink(revenueError)) {
      return { error: revenueAppointmentLinkError() };
    }

    return { error: NextResponse.json({ error: "Failed to create appointment revenue" }, { status: 500 }) };
  }

  return { revenue };
}

export async function GET(request: Request) {
  const context = await getSupabaseContext();
  if (context.error) return context.error;
  const url = new URL(request.url);
  const now = new Date();
  const from = url.searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = url.searchParams.get("to") ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  const { data, error } = await appointmentsTable(context.supabase)
    .select("*")
    .eq("business_id", context.businessId)
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[appointments.get]", { message: error.message });
    return NextResponse.json({ error: "Failed to load appointments" }, { status: 500 });
  }

  const hydratedAppointments = await hydrateAppointments(context, data ?? []);
  return NextResponse.json({ data: hydratedAppointments, meta: { source: "supabase" } });
}

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, appointmentSchema);
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const limitError = await enforcePlanLimit(context.supabase, context.businessId, "appointments");
    if (limitError) return limitError;

    const clientError = await ensureClientExists(context, payload.client_id);
    if (clientError) return clientError;

    const serviceError = await ensureActiveService(context, payload.service_id);
    if (serviceError) return serviceError;

    if (payload.status === "scheduled") {
      const timeError = await ensureTimeAvailable(context, payload.starts_at);
      if (timeError) return timeError;
    }

    if (payload.status === "completed") {
      const completionLimitError = await ensureCompletionLimitAvailable(context, {
        clientId: payload.client_id,
        appointmentUsageCountedAt: null
      });
      if (completionLimitError) return completionLimitError;
    }

    const { data, error } = await appointmentsTable(context.supabase)
      .insert({
        ...payload,
        business_id: context.businessId,
        notes: payload.notes || null
      })
      .select("*")
      .single();

    if (error) {
      console.error("[appointments.post]", { message: error.message });
      return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
    }

    if (data.status === "completed") {
      const sideEffects = await createCompletionSideEffects(context, data);
      if (sideEffects.error) return sideEffects.error;
    }

    const [hydratedAppointment] = await hydrateAppointments(context, data ? [data] : []);
    return NextResponse.json({ data: hydratedAppointment ?? data, meta: { source: "supabase" } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const actionPayload = appointmentStatusActionSchema.safeParse(body);
    if (actionPayload.success) {
      return updateAppointmentStatus(context, actionPayload.data.id, actionPayload.data.action);
    }

    const payload = appointmentUpdateSchema.parse(body);

    const { id, ...updates } = payload;
    if (updates.client_id) {
      const clientError = await ensureClientExists(context, updates.client_id);
      if (clientError) return clientError;
    }

    if (updates.service_id) {
      const serviceError = await ensureActiveService(context, updates.service_id);
      if (serviceError) return serviceError;
    }

    if (updates.starts_at && updates.status === "scheduled") {
      const timeError = await ensureTimeAvailable(context, updates.starts_at, id);
      if (timeError) return timeError;
    }

    if (updates.status === "completed") {
      const { data: existingAppointment, error: existingAppointmentError } = await appointmentDetailsTable(context.supabase)
        .select("*")
        .eq("business_id", context.businessId)
        .eq("id", id)
        .limit(1)
        .single();

      if (existingAppointmentError || !existingAppointment) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      const completionLimitError = await ensureCompletionLimitAvailable(context, {
        clientId: updates.client_id ?? existingAppointment.client_id,
        appointmentUsageCountedAt: existingAppointment.usage_counted_at
      });
      if (completionLimitError) return completionLimitError;
    }

    const updatePayload: AppointmentUpdate = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, "notes") ? { notes: updates.notes || null } : {})
    };
    const { data, error } = await appointmentsTable(context.supabase)
      .update(updatePayload)
      .eq("id", id)
      .eq("business_id", context.businessId)
      .select("*")
      .single();

    if (error) {
      console.error("[appointments.patch]", { message: error.message });
      return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
    }

    if (data.status === "completed") {
      const sideEffects = await createCompletionSideEffects(context, data);
      if (sideEffects.error) return sideEffects.error;
    }

    const [hydratedAppointment] = await hydrateAppointments(context, data ? [data] : []);
    return NextResponse.json({ data: hydratedAppointment ?? data, meta: { source: "supabase" } });
  } catch (error) {
    return apiError(error);
  }
}

async function updateAppointmentStatus(
  context: { supabase: SupabaseServerClient; businessId: string },
  appointmentId: string,
  action: "complete" | "cancel" | "no_show"
) {
  const { data: appointment, error: appointmentError } = await appointmentDetailsTable(context.supabase)
    .select("*")
    .eq("business_id", context.businessId)
    .eq("id", appointmentId)
    .limit(1)
    .single();

  if (appointmentError || !appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const nextStatus: AppointmentStatus = action === "complete" ? "completed" : action === "cancel" ? "cancelled" : "no_show";

  if (action === "complete") {
    if (appointment.status === "completed") {
      return NextResponse.json({ error: "Запись уже завершена. Доход уже создан." }, { status: 409 });
    }

    if (appointment.status !== "scheduled") {
      return NextResponse.json({ error: "Завершить можно только запланированную запись." }, { status: 422 });
    }

    const completionLimitError = await ensureCompletionLimitAvailable(context, {
      clientId: appointment.client_id,
      appointmentUsageCountedAt: appointment.usage_counted_at
    });
    if (completionLimitError) return completionLimitError;

    const { data: existingRevenue, error: existingRevenueError } = await revenuesTable(context.supabase)
      .select("id")
      .eq("business_id", context.businessId)
      .eq("appointment_id", appointmentId)
      .limit(1);

    if (existingRevenueError) {
      console.error("[appointments.status.revenueCheck]", { message: existingRevenueError.message });
      if (isMissingRevenueAppointmentLink(existingRevenueError)) {
        return revenueAppointmentLinkError();
      }

      return NextResponse.json({ error: "Failed to check appointment revenue" }, { status: 500 });
    }

    if (existingRevenue?.length) {
      return NextResponse.json({ error: "Запись уже завершена. Доход уже создан." }, { status: 409 });
    }
  }

  const { data: updatedAppointment, error: updateError } = await appointmentsTable(context.supabase)
    .update({ status: nextStatus })
    .eq("id", appointmentId)
    .eq("business_id", context.businessId)
    .select("*")
    .single();

  if (updateError || !updatedAppointment) {
    console.error("[appointments.status.update]", { message: updateError?.message ?? "No appointment returned" });
    return NextResponse.json({ error: "Failed to update appointment status" }, { status: 500 });
  }

  if (action !== "complete") {
    const [hydratedAppointment] = await hydrateAppointments(context, [updatedAppointment]);
    return NextResponse.json({ data: hydratedAppointment ?? updatedAppointment, meta: { source: "supabase" } });
  }

  const sideEffects = await createCompletionSideEffects(context, updatedAppointment);
  if (sideEffects.error) return sideEffects.error;

  const [hydratedAppointment] = await hydrateAppointments(context, [updatedAppointment]);
  return NextResponse.json({ data: hydratedAppointment ?? updatedAppointment, revenue: sideEffects.revenue, meta: { source: "supabase" } });
}

export async function DELETE(request: Request) {
  try {
    const payload = await parseJson(request, appointmentDeleteSchema);
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const { error } = await appointmentsTable(context.supabase)
      .delete()
      .eq("id", payload.id)
      .eq("business_id", context.businessId);

    if (error) {
      console.error("[appointments.delete]", { message: error.message });
      return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 });
    }

    return NextResponse.json({ data: { id: payload.id } });
  } catch (error) {
    return apiError(error);
  }
}
