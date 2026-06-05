import { NextResponse } from "next/server";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { enforcePlanLimit } from "@/lib/server/billing";
import { createClient } from "@/lib/supabase/server";
import { appointmentDeleteSchema, appointmentSchema, appointmentStatusActionSchema, appointmentUpdateSchema } from "@/lib/validators";
import type { Appointment, AppointmentStatus, Revenue } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type AppointmentInsert = Omit<Appointment, "id" | "created_at">;
type AppointmentUpdate = Partial<Omit<Appointment, "id" | "business_id" | "created_at">>;
type AppointmentConflictRow = Pick<Appointment, "id">;
type ServiceStatusRow = { id: string; active: boolean; name?: string; price?: number };
type ClientExistsRow = { id: string };
type AppointmentDetailsRow = Appointment;
type RevenueInsert = Omit<Revenue, "id" | "created_at">;

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
    .select("id")
    .eq("business_id", context.businessId)
    .eq("id", clientId)
    .limit(1);

  if (error || !data?.length) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return null;
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

  return NextResponse.json({ data, meta: { source: "supabase" } });
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

    return NextResponse.json({ data, meta: { source: "supabase" } }, { status: 201 });
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

    return NextResponse.json({ data, meta: { source: "supabase" } });
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
    return NextResponse.json({ data: updatedAppointment, meta: { source: "supabase" } });
  }

  const serviceResult = await getServiceForRevenue(context, updatedAppointment.service_id);
  if (serviceResult.error) return serviceResult.error;

  const { data: revenue, error: revenueError } = await revenuesTable(context.supabase)
    .insert({
      business_id: context.businessId,
      appointment_id: updatedAppointment.id,
      amount: Number(serviceResult.service.price ?? 0),
      category: "Оплата за услугу",
      description: serviceResult.service.name ? `Оплата за услугу: ${serviceResult.service.name}` : "Оплата за услугу",
      occurred_at: updatedAppointment.starts_at
    })
    .select("*")
    .single();

  if (revenueError || !revenue) {
    console.error("[appointments.status.revenue]", { message: revenueError?.message ?? "No revenue returned" });
    if (revenueError && isMissingRevenueAppointmentLink(revenueError)) {
      return revenueAppointmentLinkError();
    }

    return NextResponse.json({ error: "Failed to create appointment revenue" }, { status: 500 });
  }

  return NextResponse.json({ data: updatedAppointment, revenue, meta: { source: "supabase" } });
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
