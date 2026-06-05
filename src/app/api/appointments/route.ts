import { NextResponse } from "next/server";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { appointmentDeleteSchema, appointmentSchema, appointmentUpdateSchema } from "@/lib/validators";
import type { Appointment } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type AppointmentInsert = Omit<Appointment, "id" | "created_at">;
type AppointmentUpdate = Partial<Omit<Appointment, "id" | "business_id" | "created_at">>;
type AppointmentConflictRow = Pick<Appointment, "id">;
type ServiceStatusRow = { id: string; active: boolean };
type ClientExistsRow = { id: string };

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
      order: (column: "starts_at", options: { ascending: boolean }) => Promise<QueryResult<Appointment[]>>;
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

function appointmentConflictsTable(supabase: SupabaseServerClient) {
  return supabase.from("appointments") as unknown as AppointmentConflictsTable;
}

function servicesStatusTable(supabase: SupabaseServerClient) {
  return supabase.from("services") as unknown as ServicesStatusTable;
}

function clientsStatusTable(supabase: SupabaseServerClient) {
  return supabase.from("clients") as unknown as ClientsStatusTable;
}

async function getSupabaseContext() {
  const envStatus = getSupabaseEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length) {
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

export async function GET() {
  const context = await getSupabaseContext();
  if (context.error) return context.error;

  const { data, error } = await appointmentsTable(context.supabase)
    .select("*")
    .eq("business_id", context.businessId)
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
    const payload = await parseJson(request, appointmentUpdateSchema);
    const context = await getSupabaseContext();
    if (context.error) return context.error;

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
