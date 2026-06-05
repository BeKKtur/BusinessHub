import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseJson, requireAuth } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type BusinessRow = { id: string };
type BusinessInsert = { owner_id: string; name: string; type: string };
type BusinessUpdate = { name?: string; type: string };

type BusinessesTable = {
  select: (columns: string) => {
    eq: (column: "owner_id", value: string) => {
      limit: (count: number) => {
        maybeSingle: () => Promise<QueryResult<BusinessRow | null>>;
      };
    };
  };
  update: (payload: BusinessUpdate) => {
    eq: (column: "id", value: string) => Promise<QueryResult<null>>;
  };
  insert: (payload: BusinessInsert) => Promise<QueryResult<null>>;
};

function businessesTable(supabase: SupabaseServerClient) {
  return supabase.from("businesses") as unknown as BusinessesTable;
}

const onboardingSchema = z.object({
  businessType: z.string().trim().min(1),
  businessName: z.string().trim().min(2).optional()
});

export async function POST(request: Request) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const payload = await parseJson(request, onboardingSchema);
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const table = businessesTable(supabase);
    const { data: existing } = await table.select("id").eq("owner_id", user.id).limit(1).maybeSingle();

    if (existing) {
      const { error } = await table
        .update({ type: payload.businessType, ...(payload.businessName ? { name: payload.businessName } : {}) })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: "Не удалось обновить бизнес" }, { status: 500 });
    } else {
      const { error } = await table.insert({
        owner_id: user.id,
        name: payload.businessName || "BusinessHub Workspace",
        type: payload.businessType
      });
      if (error) return NextResponse.json({ error: "Не удалось создать бизнес" }, { status: 500 });
    }

    return NextResponse.json({ data: { nextPath: "/dashboard" } });
  } catch (error) {
    return apiError(error);
  }
}
