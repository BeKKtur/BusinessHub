import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server/admin-auth";

type QueryError = { message: string };
type BaseSubscription = {
  id: string;
  business_id: string;
  plan: "free" | "pro" | "business";
  status: string;
  paddle_id: string | null;
};
type AdminSubscription = BaseSubscription & {
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  paddle_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billed_at: string | null;
};

function isMissingSubscriptionColumn(error: QueryError) {
  return /column .* does not exist|schema cache|Could not find.*column/i.test(error.message);
}

function normalizeSubscription(subscription: BaseSubscription & Partial<AdminSubscription>): AdminSubscription {
  return {
    id: subscription.id,
    business_id: subscription.business_id,
    plan: subscription.plan,
    status: subscription.status,
    paddle_id: subscription.paddle_id ?? null,
    paddle_subscription_id: subscription.paddle_subscription_id ?? subscription.paddle_id ?? null,
    paddle_customer_id: subscription.paddle_customer_id ?? null,
    paddle_price_id: subscription.paddle_price_id ?? null,
    current_period_start: subscription.current_period_start ?? null,
    current_period_end: subscription.current_period_end ?? subscription.next_billed_at ?? null,
    next_billed_at: subscription.next_billed_at ?? null
  };
}

export async function GET(request: Request) {
  const context = await requireSuperAdmin(request);
  if (context.error) return context.error;

  const { data: businesses, error: businessesError } = await context.admin
    .from("businesses")
    .select("id")
    .order("created_at", { ascending: false });

  if (businessesError) {
    console.error("[admin.subscriptions.businesses]", { message: businessesError.message });
    return NextResponse.json({ error: "Failed to load subscription businesses" }, { status: 500 });
  }

  const fullResult = await context.admin
    .from("subscriptions")
    .select("id, business_id, plan, status, paddle_id, paddle_subscription_id, paddle_customer_id, paddle_price_id, current_period_start, current_period_end, next_billed_at")
    .order("status", { ascending: true });

  let subscriptions: AdminSubscription[] = [];

  if (fullResult.error) {
    if (!isMissingSubscriptionColumn(fullResult.error)) {
      console.error("[admin.subscriptions.get]", { message: fullResult.error.message });
      return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
    }

    console.warn("[admin.subscriptions.get.fallback]", {
      message: fullResult.error.message,
      migration: "Apply supabase/migrations/015_admin_subscription_schema_safety.sql"
    });

    const baseResult = await context.admin
      .from("subscriptions")
      .select("id, business_id, plan, status, paddle_id")
      .order("status", { ascending: true });

    if (baseResult.error) {
      console.error("[admin.subscriptions.get.base]", { message: baseResult.error.message });
      return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
    }

    subscriptions = (baseResult.data ?? []).map((subscription) => normalizeSubscription(subscription as BaseSubscription));
  } else {
    subscriptions = (fullResult.data ?? []).map((subscription) => normalizeSubscription(subscription as AdminSubscription));
  }

  const subscriptionsByBusinessId = new Map(subscriptions.map((subscription) => [subscription.business_id, subscription]));
  const data = (businesses ?? []).map((business) => {
    const subscription = subscriptionsByBusinessId.get(business.id);
    if (subscription) return subscription;

    return {
      id: `fallback-${business.id}`,
      business_id: business.id,
      plan: "free" as const,
      status: "active",
      paddle_id: null,
      paddle_subscription_id: null,
      paddle_customer_id: null,
      paddle_price_id: null,
      current_period_start: null,
      current_period_end: null,
      next_billed_at: null
    };
  });

  return NextResponse.json({ data });
}
