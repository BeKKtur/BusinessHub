import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api";
import { adminChangePlanSchema, logAdminAction, requireSuperAdmin } from "@/lib/server/admin-auth";

export async function POST(request: Request) {
  try {
    const context = await requireSuperAdmin(request);
    if (context.error) return context.error;

    const payload = await parseJson(request, adminChangePlanSchema);
    const { data: business, error: businessError } = await context.admin
      .from("businesses")
      .select("id, owner_id, name")
      .eq("owner_id", payload.userId)
      .limit(1)
      .single();

    if (businessError || !business) {
      console.error("[admin.change-plan.business]", { message: businessError?.message ?? "Business not found" });
      return NextResponse.json({ error: "Business not found for user" }, { status: 404 });
    }

    const { data: existingSubscription, error: existingError } = await context.admin
      .from("subscriptions")
      .select("id")
      .eq("business_id", business.id)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[admin.change-plan.lookup]", { message: existingError.message });
      return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
    }

    const query = existingSubscription
      ? context.admin
          .from("subscriptions")
          .update({
            plan: payload.plan,
            status: "active",
            updated_at: new Date().toISOString(),
            ...(payload.plan === "free"
              ? {
                  paddle_id: null,
                  paddle_subscription_id: null,
                  paddle_customer_id: null,
                  paddle_price_id: null,
                  next_billed_at: null,
                  trial_ends_at: null,
                  cancelled_at: null,
                  portal_url: null
                }
              : {})
          })
          .eq("id", existingSubscription.id)
          .select("id, business_id, plan, status, paddle_id, next_billed_at")
          .single()
      : context.admin
          .from("subscriptions")
          .insert({ business_id: business.id, user_id: payload.userId, plan: payload.plan, status: "active" })
          .select("id, business_id, plan, status, paddle_id, next_billed_at")
          .single();

    const { data, error } = await query;

    if (error || !data) {
      console.error("[admin.change-plan.save]", { message: error?.message ?? "No row returned" });
      return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
    }

    await logAdminAction(context, "change_plan", { plan: payload.plan, business_id: business.id }, payload.userId);
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
