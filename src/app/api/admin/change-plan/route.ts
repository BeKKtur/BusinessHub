import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api";
import { adminChangePlanSchema, logAdminAction, requireSuperAdmin } from "@/lib/server/admin-auth";

type Plan = "free" | "pro" | "business";

function resolveGrant(payload: { plan?: Plan; grant?: "free" | "pro_30" | "pro_90" | "business_30" | "business_90" | "business_forever" }) {
  const grant = payload.grant ?? payload.plan ?? "free";
  const now = new Date();
  const currentPeriodEnd = new Date(now);

  if (grant === "pro_30") {
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    return { plan: "pro" as const, currentPeriodStart: now.toISOString(), currentPeriodEnd: currentPeriodEnd.toISOString() };
  }

  if (grant === "pro_90") {
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 90);
    return { plan: "pro" as const, currentPeriodStart: now.toISOString(), currentPeriodEnd: currentPeriodEnd.toISOString() };
  }

  if (grant === "business_30") {
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    return { plan: "business" as const, currentPeriodStart: now.toISOString(), currentPeriodEnd: currentPeriodEnd.toISOString() };
  }

  if (grant === "business_90") {
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 90);
    return { plan: "business" as const, currentPeriodStart: now.toISOString(), currentPeriodEnd: currentPeriodEnd.toISOString() };
  }

  if (grant === "business_forever" || grant === "business") {
    return { plan: "business" as const, currentPeriodStart: now.toISOString(), currentPeriodEnd: null };
  }

  if (grant === "pro") {
    return { plan: "pro" as const, currentPeriodStart: now.toISOString(), currentPeriodEnd: null };
  }

  return { plan: "free" as const, currentPeriodStart: now.toISOString(), currentPeriodEnd: null };
}

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
      .select("id, plan, status, paddle_subscription_id, paddle_customer_id, paddle_price_id, current_period_end")
      .eq("business_id", business.id)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[admin.change-plan.lookup]", { message: existingError.message });
      return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
    }

    const grant = resolveGrant(payload);
    const hasPaddleSubscription = Boolean(existingSubscription?.paddle_subscription_id);
    if (hasPaddleSubscription && !payload.confirmOverwrite) {
      return NextResponse.json(
        {
          error: "У пользователя есть Paddle-подписка. Подтвердите ручное изменение плана, чтобы продолжить.",
          code: "PADDLE_SUBSCRIPTION_CONFIRMATION_REQUIRED"
        },
        { status: 409 }
      );
    }

    const updatePayload = {
      plan: grant.plan,
      status: "active",
      current_period_start: grant.currentPeriodStart,
      current_period_end: grant.currentPeriodEnd,
      next_billed_at: grant.currentPeriodEnd,
      cancelled_at: null,
      trial_ends_at: null,
      updated_at: new Date().toISOString()
    };

    const query = existingSubscription
      ? context.admin
          .from("subscriptions")
          .update(updatePayload)
          .eq("id", existingSubscription.id)
          .select("id, business_id, plan, status, paddle_id, paddle_subscription_id, paddle_customer_id, paddle_price_id, current_period_start, current_period_end, next_billed_at")
          .single()
      : context.admin
          .from("subscriptions")
          .insert({ business_id: business.id, user_id: payload.userId, ...updatePayload })
          .select("id, business_id, plan, status, paddle_id, paddle_subscription_id, paddle_customer_id, paddle_price_id, current_period_start, current_period_end, next_billed_at")
          .single();

    const { data, error } = await query;

    if (error || !data) {
      console.error("[admin.change-plan.save]", { message: error?.message ?? "No row returned" });
      return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
    }

    await logAdminAction(
      context,
      "manual_subscription_grant",
      {
        admin_user_id: context.actorId,
        target_user_id: payload.userId,
        business_id: business.id,
        old_plan: existingSubscription?.plan ?? null,
        new_plan: data.plan,
        old_status: existingSubscription?.status ?? null,
        new_status: data.status,
        old_current_period_end: existingSubscription?.current_period_end ?? null,
        new_current_period_end: data.current_period_end ?? null,
        paddle_subscription_id: existingSubscription?.paddle_subscription_id ?? null,
        grant: payload.grant ?? payload.plan,
        reason: payload.reason,
        manual_without_paddle_payment: true
      },
      payload.userId
    );
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
