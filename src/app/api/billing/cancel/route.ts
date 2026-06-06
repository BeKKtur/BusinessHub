import { NextResponse } from "next/server";
import { getSupabaseEnvStatus, supabaseConfigErrorResponse } from "@/lib/api";
import { createPaddleClient, getBusinessSubscription, getMissingPaddleEnv, paddleConfigError } from "@/lib/server/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BillingBusiness = { id: string };

export async function POST() {
  const envStatus = getSupabaseEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
    return supabaseConfigErrorResponse();
  }

  const missingPaddleEnv = getMissingPaddleEnv();
  if (missingPaddleEnv.length) {
    return paddleConfigError(missingPaddleEnv);
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
  if (subscription.plan === "free" || !subscription.paddle_subscription_id) {
    return NextResponse.json({ error: "Active paid subscription not found" }, { status: 404 });
  }

  try {
    const paddle = createPaddleClient();
    await paddle.subscriptions.cancel(subscription.paddle_subscription_id, { effectiveFrom: "next_billing_period" });
  } catch (error) {
    console.error("[billing.cancel.paddle]", { message: error instanceof Error ? error.message : "Unknown Paddle cancel error" });
    return NextResponse.json({ error: "Failed to cancel subscription in Paddle" }, { status: 502 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      cancelled_at: now,
      updated_at: now
    })
    .eq("business_id", business.id);

  if (updateError) {
    console.error("[billing.cancel.save]", { message: updateError.message });
    return NextResponse.json({ error: "Subscription cancelled in Paddle but local status was not updated" }, { status: 500 });
  }

  return NextResponse.json({ data: { status: "canceled", cancelled_at: now } });
}
