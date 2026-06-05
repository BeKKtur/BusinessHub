import { NextResponse } from "next/server";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { serviceDeleteSchema, serviceSchema, serviceUpdateSchema } from "@/lib/validators";
import type { Service } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type ServiceInsert = Omit<Service, "id" | "created_at">;
type ServiceUpdate = Partial<Omit<Service, "id" | "business_id" | "created_at">>;

type BusinessesTable = {
  select: (columns: string) => {
    eq: (column: "owner_id", value: string) => {
      limit: (count: number) => {
        single: () => Promise<QueryResult<{ id: string }>>;
      };
    };
  };
};

type ServicesTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      order: (column: "created_at", options: { ascending: boolean }) => Promise<QueryResult<Service[]>>;
    };
  };
  insert: (payload: ServiceInsert) => {
    select: (columns: string) => {
      single: () => Promise<QueryResult<Service>>;
    };
  };
  update: (payload: ServiceUpdate) => {
    eq: (column: "id", value: string) => {
      eq: (column: "business_id", value: string) => {
        select: (columns: string) => {
          single: () => Promise<QueryResult<Service>>;
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

function servicesTable(supabase: SupabaseServerClient) {
  return supabase.from("services") as unknown as ServicesTable;
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

export async function GET() {
  const context = await getSupabaseContext();
  if (context.error) return context.error;

  const { data, error } = await servicesTable(context.supabase)
    .select("*")
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[services.get]", { message: error.message });
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }

  return NextResponse.json({ data, meta: { source: "supabase" } });
}

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, serviceSchema);
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const { data, error } = await servicesTable(context.supabase)
      .insert({
        ...payload,
        business_id: context.businessId,
        description: payload.description || null
      })
      .select("*")
      .single();

    if (error) {
      console.error("[services.post]", { message: error.message });
      return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
    }

    return NextResponse.json({ data, meta: { source: "supabase" } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await parseJson(request, serviceUpdateSchema);
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const { id, ...updates } = payload;
    const updatePayload: ServiceUpdate = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, "description") ? { description: updates.description || null } : {})
    };
    const { data, error } = await servicesTable(context.supabase)
      .update(updatePayload)
      .eq("id", id)
      .eq("business_id", context.businessId)
      .select("*")
      .single();

    if (error) {
      console.error("[services.patch]", { message: error.message });
      return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
    }

    return NextResponse.json({ data, meta: { source: "supabase" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await parseJson(request, serviceDeleteSchema);
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const { error } = await servicesTable(context.supabase)
      .delete()
      .eq("id", payload.id)
      .eq("business_id", context.businessId);

    if (error) {
      console.error("[services.delete]", { message: error.message });
      return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
    }

    return NextResponse.json({ data: { id: payload.id } });
  } catch (error) {
    return apiError(error);
  }
}
