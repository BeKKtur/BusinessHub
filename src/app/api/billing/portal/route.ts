import { NextResponse } from "next/server";
import { apiError, getSupabaseEnvStatus, supabaseConfigErrorResponse } from "@/lib/api";
import { createPaddleClient, getBusinessSubscription, getMissingPaddleEnv, paddleConfigError } from "@/lib/server/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BillingBusiness = { id: string };

export async function POST() {
  try {
    const envStatus = getSupabaseEnvStatus();
    if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
      return supabaseConfigErrorResponse();
    }

    const missingEnv = getMissingPaddleEnv();
    if (missingEnv.includes("PADDLE_API_KEY")) {
      return paddleConfigError(["PADDLE_API_KEY"]);
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

    const subscription = await getBusinessSubscription(supabase, business.id);
    if (subscription.plan === "free" || !subscription.paddle_customer_id || !subscription.paddle_subscription_id) {
      return NextResponse.json({ error: "Нет активной Paddle подписки для управления." }, { status: 404 });
    }

    if (subscription.portal_url) {
      return NextResponse.json({ data: { url: subscription.portal_url } });
    }

    const paddle = createPaddleClient();
    const session = await paddle.customerPortalSessions.create(subscription.paddle_customer_id, [
      subscription.paddle_subscription_id
    ]);
    const url = session.urls.subscriptions[0]?.updateSubscriptionPaymentMethod ?? session.urls.general.overview;

    const admin = createAdminClient();
    await admin
      .from("subscriptions")
      .update({ portal_url: url, updated_at: new Date().toISOString() })
      .eq("business_id", business.id);

    return NextResponse.json({ data: { url } });
  } catch (error) {
    console.error("[billing.portal]", { message: error instanceof Error ? error.message : "Unknown portal error" });
    return apiError(error);
  }
}
