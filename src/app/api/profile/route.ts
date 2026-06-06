import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseJson, requireAuth } from "@/lib/api";
import { businessTypes } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Введите имя"),
  businessName: z.string().trim().min(2, "Введите название бизнеса"),
  businessType: z.enum(businessTypes)
});

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: QueryError };
type ProfileRow = { id: string; email: string; full_name: string | null; role: string };
type BusinessRow = { id: string; owner_id: string; name: string; type: string };
type SubscriptionRow = { plan: string; status: string };

type ProfilesTable = {
  select: (columns: string) => {
    eq: (column: "id", value: string) => {
      maybeSingle: () => Promise<QueryResult<ProfileRow | null>>;
    };
  };
  update: (payload: { full_name: string }) => {
    eq: (column: "id", value: string) => Promise<QueryResult<null>>;
  };
};

type BusinessesTable = {
  select: (columns: string) => {
    eq: (column: "owner_id", value: string) => {
      limit: (count: number) => {
        maybeSingle: () => Promise<QueryResult<BusinessRow | null>>;
      };
    };
  };
  update: (payload: { name: string; type: string }) => {
    eq: (column: "id", value: string) => {
      eq: (column: "owner_id", value: string) => Promise<QueryResult<null>>;
    };
  };
};

type SubscriptionsTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      limit: (count: number) => {
        maybeSingle: () => Promise<QueryResult<SubscriptionRow | null>>;
      };
    };
  };
};

function profilesTable(supabase: SupabaseServerClient) {
  return supabase.from("profiles") as unknown as ProfilesTable;
}

function businessesTable(supabase: SupabaseServerClient) {
  return supabase.from("businesses") as unknown as BusinessesTable;
}

function subscriptionsTable(supabase: SupabaseServerClient) {
  return supabase.from("subscriptions") as unknown as SubscriptionsTable;
}

async function getContext() {
  const authError = await requireAuth();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await profilesTable(supabase)
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "Profile not found" }, { status: 404 }) };
  }

  const { data: business, error: businessError } = await businessesTable(supabase)
    .select("id, owner_id, name, type")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (businessError || !business) {
    return { error: NextResponse.json({ error: "Business not found" }, { status: 404 }) };
  }

  return { supabase, user, profile, business };
}

export async function GET() {
  try {
    const context = await getContext();
    if ("error" in context) return context.error;

    const { data: subscription } = await subscriptionsTable(context.supabase)
      .select("plan, status")
      .eq("business_id", context.business.id)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      data: {
        name: context.profile.full_name,
        email: context.profile.email,
        role: context.profile.role,
        businessName: context.business.name,
        businessType: context.business.type,
        plan: subscription?.plan ?? "free",
        subscriptionStatus: subscription?.status ?? "active"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getContext();
    if ("error" in context) return context.error;

    const payload = await parseJson(request, profileUpdateSchema);

    const { error: profileError } = await profilesTable(context.supabase)
      .update({ full_name: payload.name })
      .eq("id", context.user.id);
    if (profileError) {
      console.error("[profile.update.profile]", { message: profileError.message });
      return NextResponse.json({ error: "Не удалось обновить профиль" }, { status: 500 });
    }

    const { error: businessError } = await businessesTable(context.supabase)
      .update({ name: payload.businessName, type: payload.businessType })
      .eq("id", context.business.id)
      .eq("owner_id", context.user.id);
    if (businessError) {
      console.error("[profile.update.business]", { message: businessError.message });
      return NextResponse.json({ error: "Не удалось обновить бизнес" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        name: payload.name,
        email: context.profile.email,
        role: context.profile.role,
        businessName: payload.businessName,
        businessType: payload.businessType
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
