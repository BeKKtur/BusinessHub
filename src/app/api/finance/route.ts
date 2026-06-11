import { NextResponse } from "next/server";
import { apiError, getSupabaseEnvStatus, parseJson, supabaseConfigErrorResponse } from "@/lib/api";
import { featureUpgradeResponse, getFeatureAccess } from "@/lib/server/feature-access";
import { createClient } from "@/lib/supabase/server";
import { financeOperationDeleteSchema, financeOperationSchema, financeOperationUpdateSchema } from "@/lib/validators";
import type { Database } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type MoneyRow = Database["public"]["Tables"]["revenues"]["Row"];
type MoneyInsert = Database["public"]["Tables"]["revenues"]["Insert"];
type MoneyUpdate = Database["public"]["Tables"]["revenues"]["Update"];

type BusinessesTable = {
  select: (columns: string) => {
    eq: (column: "owner_id", value: string) => {
      limit: (count: number) => {
        single: () => Promise<QueryResult<{ id: string }>>;
      };
    };
  };
};

type MoneyTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      order: (column: "occurred_at", options: { ascending: boolean }) => Promise<QueryResult<MoneyRow[]>>;
    };
  };
  insert: (payload: MoneyInsert) => {
    select: (columns: string) => {
      single: () => Promise<QueryResult<MoneyRow>>;
    };
  };
  update: (payload: MoneyUpdate) => {
    eq: (column: "id", value: string) => {
      eq: (column: "business_id", value: string) => {
        select: (columns: string) => {
          single: () => Promise<QueryResult<MoneyRow>>;
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

function moneyTable(supabase: SupabaseServerClient, type: "income" | "expense") {
  return supabase.from(type === "income" ? "revenues" : "expenses") as unknown as MoneyTable;
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

  const access = await getFeatureAccess(supabase, business.id, user.id, "finance");
  if (!access.allowed) {
    return { error: featureUpgradeResponse(access) };
  }

  return { supabase, businessId: business.id };
}

export async function GET() {
  const context = await getSupabaseContext();
  if (context.error) return context.error;

  const [revenuesResult, expensesResult] = await Promise.all([
    moneyTable(context.supabase, "income").select("*").eq("business_id", context.businessId).order("occurred_at", { ascending: false }),
    moneyTable(context.supabase, "expense").select("*").eq("business_id", context.businessId).order("occurred_at", { ascending: false })
  ]);

  if (revenuesResult.error || expensesResult.error) {
    console.error("[finance.get]", { message: revenuesResult.error?.message ?? expensesResult.error?.message });
    return NextResponse.json({ error: "Failed to load finance operations" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      revenues: revenuesResult.data ?? [],
      expenses: expensesResult.data ?? []
    },
    meta: { source: "supabase" }
  });
}

export async function POST(request: Request) {
  try {
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const payload = await parseJson(request, financeOperationSchema);
    const { type, ...operation } = payload;
    const { data, error } = await moneyTable(context.supabase, type)
      .insert({
        business_id: context.businessId,
        amount: operation.amount,
        category: operation.category,
        description: operation.description || null,
        occurred_at: operation.occurred_at,
        ...(type === "income" ? { appointment_id: null } : {})
      })
      .select("*")
      .single();

    if (error) {
      console.error("[finance.post]", { message: error.message });
      return NextResponse.json({ error: "Failed to create finance operation" }, { status: 500 });
    }

    return NextResponse.json({ data: { ...data, type }, meta: { source: "supabase" } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const payload = await parseJson(request, financeOperationUpdateSchema);
    const { id, type, ...updates } = payload;
    const { data, error } = await moneyTable(context.supabase, type)
      .update({
        ...updates,
        ...(Object.prototype.hasOwnProperty.call(updates, "description") ? { description: updates.description || null } : {})
      })
      .eq("id", id)
      .eq("business_id", context.businessId)
      .select("*")
      .single();

    if (error) {
      console.error("[finance.patch]", { message: error.message });
      return NextResponse.json({ error: "Failed to update finance operation" }, { status: 500 });
    }

    return NextResponse.json({ data: { ...data, type }, meta: { source: "supabase" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getSupabaseContext();
    if (context.error) return context.error;

    const payload = await parseJson(request, financeOperationDeleteSchema);
    const { error } = await moneyTable(context.supabase, payload.type)
      .delete()
      .eq("id", payload.id)
      .eq("business_id", context.businessId);

    if (error) {
      console.error("[finance.delete]", { message: error.message });
      return NextResponse.json({ error: "Failed to delete finance operation" }, { status: 500 });
    }

    return NextResponse.json({ data: { id: payload.id, type: payload.type }, meta: { source: "supabase" } });
  } catch (error) {
    return apiError(error);
  }
}
