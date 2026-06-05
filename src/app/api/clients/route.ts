import { NextResponse } from "next/server";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { enforcePlanLimit } from "@/lib/server/billing";
import { createClient } from "@/lib/supabase/server";
import { clientDeleteSchema, clientSchema, clientUpdateSchema } from "@/lib/validators";
import type { Client } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type ClientInsert = Omit<Client, "id" | "created_at" | "visits_count"> & { visits_count?: number };
type ClientUpdate = Partial<Omit<Client, "id" | "business_id" | "created_at">>;

type BusinessesTable = {
  select: (columns: string) => {
    eq: (column: "owner_id", value: string) => {
      limit: (count: number) => {
        single: () => Promise<QueryResult<{ id: string }>>;
      };
    };
  };
};

type ClientsTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      order: (column: "created_at", options: { ascending: boolean }) => {
        limit: (count: number) => Promise<QueryResult<Client[]>>;
      };
    };
  };
  insert: (payload: ClientInsert) => {
    select: (columns: string) => {
      single: () => Promise<QueryResult<Client>>;
    };
  };
  update: (payload: ClientUpdate) => {
    eq: (column: "id", value: string) => {
      eq: (column: "business_id", value: string) => {
        select: (columns: string) => {
          single: () => Promise<QueryResult<Client>>;
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

function businessesTable(supabase: SupabaseServerClient) {
  return supabase.from("businesses") as unknown as BusinessesTable;
}

function clientsTable(supabase: SupabaseServerClient) {
  return supabase.from("clients") as unknown as ClientsTable;
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

export async function GET(request: Request) {
  const context = await getSupabaseContext();
  if (context.error) return context.error;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);

  const { data, error } = await clientsTable(context.supabase)
    .select("*")
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[clients.get]", { message: error.message });
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }

  return NextResponse.json({ data, meta: { source: "supabase" } });
}

export async function POST(request: Request) {
  try {
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const payload = await parseJson(request, clientSchema);
    const limitError = await enforcePlanLimit(context.supabase, context.businessId, "clients");
    if (limitError) return limitError;

    const { data, error } = await clientsTable(context.supabase)
      .insert({
        business_id: context.businessId,
        name: payload.name,
        phone: payload.phone,
        email: payload.email || null,
        notes: payload.notes || null,
        telegram: payload.telegram || null
      })
      .select("*")
      .single();

    if (error) {
      console.error("[clients.post]", { message: error.message });
      return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    }

    return NextResponse.json({ data, meta: { source: "supabase" } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const payload = await parseJson(request, clientUpdateSchema);
    const { id, ...updates } = payload;
    const updatePayload: ClientUpdate = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, "email") ? { email: updates.email || null } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "notes") ? { notes: updates.notes || null } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "telegram") ? { telegram: updates.telegram || null } : {})
    };

    const { data, error } = await clientsTable(context.supabase)
      .update(updatePayload)
      .eq("id", id)
      .eq("business_id", context.businessId)
      .select("*")
      .single();

    if (error) {
      console.error("[clients.patch]", { message: error.message });
      return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
    }

    return NextResponse.json({ data, meta: { source: "supabase" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const payload = await parseJson(request, clientDeleteSchema);
    const { error } = await clientsTable(context.supabase)
      .delete()
      .eq("id", payload.id)
      .eq("business_id", context.businessId);

    if (error) {
      console.error("[clients.delete]", { message: error.message });
      return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
    }

    return NextResponse.json({ data: { id: payload.id }, meta: { source: "supabase" } });
  } catch (error) {
    return apiError(error);
  }
}
