import { NextResponse } from "next/server";
import { getSupabaseEnvStatus, supabaseConfigErrorResponse } from "@/lib/api";
import { getBusinessSubscription } from "@/lib/server/billing";
import { createClient } from "@/lib/supabase/server";

type BillingBusiness = { id: string };

export async function GET() {
  const envStatus = getSupabaseEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
    return supabaseConfigErrorResponse();
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: businessData, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();
  const business = businessData as BillingBusiness | null;

  if (businessError || !business) {
    return NextResponse.json({ error: "Business workspace not found" }, { status: 404 });
  }

  try {
    const subscription = await getBusinessSubscription(supabase, business.id);
    return NextResponse.json({
      data: subscription
    });
  } catch (error) {
    console.error("[billing.status]", { message: error instanceof Error ? error.message : "Unknown billing status error" });
    return NextResponse.json({ error: "Failed to load subscription status" }, { status: 500 });
  }
}
