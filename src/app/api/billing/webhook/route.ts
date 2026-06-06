import { NextResponse } from "next/server";
import { createPaddleClient, getPlanByPriceId, type SubscriptionUpsert } from "@/lib/server/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan } from "@/lib/plans";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function getString(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length) return value;
  }

  return null;
}

function getCustomData(data: JsonRecord) {
  return asRecord(data.customData ?? data.custom_data);
}

function getSubscriptionId(data: JsonRecord) {
  return getString(data, "id", "subscriptionId", "subscription_id");
}

function getCustomerId(data: JsonRecord) {
  return getString(data, "customerId", "customer_id");
}

function getPriceId(data: JsonRecord) {
  const items = Array.isArray(data.items) ? data.items : [];
  const firstItem = asRecord(items[0]);
  const price = asRecord(firstItem.price);
  return getString(price, "id") ?? getString(firstItem, "priceId", "price_id");
}

function getNextBilledAt(data: JsonRecord) {
  const currentBillingPeriod = asRecord(data.currentBillingPeriod ?? data.current_billing_period);
  const billingPeriod = asRecord(data.billingPeriod ?? data.billing_period);
  return getString(data, "nextBilledAt", "next_billed_at") ?? getString(currentBillingPeriod, "endsAt", "ends_at") ?? getString(billingPeriod, "endsAt", "ends_at");
}

function getCurrentPeriodStart(data: JsonRecord) {
  const currentBillingPeriod = asRecord(data.currentBillingPeriod ?? data.current_billing_period);
  const billingPeriod = asRecord(data.billingPeriod ?? data.billing_period);
  return getString(currentBillingPeriod, "startsAt", "starts_at") ?? getString(billingPeriod, "startsAt", "starts_at");
}

function getCurrentPeriodEnd(data: JsonRecord) {
  const currentBillingPeriod = asRecord(data.currentBillingPeriod ?? data.current_billing_period);
  const billingPeriod = asRecord(data.billingPeriod ?? data.billing_period);
  return getString(currentBillingPeriod, "endsAt", "ends_at") ?? getString(billingPeriod, "endsAt", "ends_at") ?? getNextBilledAt(data);
}

function getTrialEndsAt(data: JsonRecord) {
  const trialDates = asRecord(data.trialDates ?? data.trial_dates);
  return getString(trialDates, "endsAt", "ends_at");
}

function getTransactionAmount(data: JsonRecord) {
  const details = asRecord(data.details);
  const totals = asRecord(details.totals);
  const raw = getString(totals, "grandTotal", "grand_total", "subtotal") ?? getString(data, "amount");
  if (!raw) return 0;

  const amount = Number(raw);
  return Number.isFinite(amount) ? amount / 100 : 0;
}

function getTransactionCurrency(data: JsonRecord) {
  const details = asRecord(data.details);
  const totals = asRecord(details.totals);
  return getString(data, "currencyCode", "currency_code") ?? getString(totals, "currencyCode", "currency_code") ?? "USD";
}

async function findBusinessId(admin: ReturnType<typeof createAdminClient>, data: JsonRecord, subscriptionId: string | null) {
  const customData = getCustomData(data);
  const customBusinessId = getString(customData, "business_id", "businessId");
  if (customBusinessId) return customBusinessId;

  if (!subscriptionId) return null;

  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select("business_id")
    .or(`paddle_subscription_id.eq.${subscriptionId},paddle_id.eq.${subscriptionId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[billing.webhook.findBusiness]", { message: error.message });
    return null;
  }

  return (subscription as { business_id: string } | null)?.business_id ?? null;
}

async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  payload: SubscriptionUpsert
) {
  const { data: existing, error: lookupError } = await admin
    .from("subscriptions")
    .select("id, plan")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up subscription: ${lookupError.message}`);
  }

  const timestamp = new Date().toISOString();
  const existingPlan = (existing as { plan?: SubscriptionPlan } | null)?.plan;
  const subscriptionUpdate = {
    plan: payload.plan,
    status: payload.status,
    paddle_id: payload.paddle_id,
    paddle_subscription_id: payload.paddle_subscription_id,
    paddle_customer_id: payload.paddle_customer_id,
    paddle_price_id: payload.paddle_price_id,
    current_period_start: payload.current_period_start,
    current_period_end: payload.current_period_end,
    next_billed_at: payload.next_billed_at,
    trial_ends_at: payload.trial_ends_at,
    cancelled_at: payload.cancelled_at,
    portal_url: payload.portal_url
  };
  const query = existing
    ? admin
        .from("subscriptions")
        .update({ ...subscriptionUpdate, updated_at: timestamp })
        .eq("id", (existing as { id: string }).id)
        .select("id")
        .single()
    : admin
        .from("subscriptions")
        .insert({ ...payload, business_id: businessId, updated_at: timestamp })
        .select("id")
        .single();

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to save subscription: ${error.message}`);
  }

  console.info("[billing.webhook.subscription.save]", {
    businessId,
    previousPlan: existingPlan ?? null,
    plan: payload.plan,
    status: payload.status,
    paddleSubscriptionId: payload.paddle_subscription_id ?? null
  });
}

async function handleSubscriptionEvent(eventType: string, data: JsonRecord) {
  const admin = createAdminClient();
  const subscriptionId = getSubscriptionId(data);
  const businessId = await findBusinessId(admin, data, subscriptionId);

  if (!businessId) {
    console.warn("[billing.webhook.subscription.skip]", { eventType, subscriptionId });
    return { skipped: true, reason: "business_id not found" };
  }

  const priceId = getPriceId(data);
  const eventPlan = getPlanByPriceId(priceId);
  const status = eventType === "subscription.canceled" ? "canceled" : (getString(data, "status") ?? "active");
  const { data: currentSubscription } = await admin
    .from("subscriptions")
    .select("plan")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();
  const currentPlan = (currentSubscription as { plan?: SubscriptionPlan } | null)?.plan;
  const plan: SubscriptionPlan = status === "canceled" ? "free" : eventPlan ?? currentPlan ?? "free";

  if (!eventPlan && status !== "canceled") {
    console.warn("[billing.webhook.subscription.plan]", {
      eventType,
      businessId,
      priceId,
      currentPlan: currentPlan ?? null,
      selectedPlan: plan,
      message: "Paddle event did not include a mapped price id. Preserving current plan."
    });
  }

  await upsertSubscription(admin, businessId, {
    business_id: businessId,
    plan,
    status,
    paddle_id: subscriptionId,
    paddle_subscription_id: subscriptionId,
    paddle_customer_id: getCustomerId(data),
    paddle_price_id: priceId,
    current_period_start: status === "canceled" ? null : getCurrentPeriodStart(data),
    current_period_end: status === "canceled" ? null : getCurrentPeriodEnd(data),
    next_billed_at: status === "canceled" ? null : getNextBilledAt(data),
    trial_ends_at: getTrialEndsAt(data),
    cancelled_at: status === "canceled" ? new Date().toISOString() : null,
    portal_url: null
  });

  return { skipped: false };
}

async function handleTransactionCompleted(data: JsonRecord) {
  const admin = createAdminClient();
  const transactionId = getString(data, "id");
  const subscriptionId = getString(data, "subscriptionId", "subscription_id");
  const businessId = await findBusinessId(admin, data, subscriptionId);

  if (!businessId || !transactionId) {
    console.warn("[billing.webhook.transaction.skip]", { transactionId, subscriptionId });
    return { skipped: true, reason: "business_id or transaction_id not found" };
  }

  const { error } = await admin.from("payments").upsert(
    {
      business_id: businessId,
      subscription_id: subscriptionId
        ? (
            (
              await admin
                .from("subscriptions")
                .select("id")
                .or(`paddle_subscription_id.eq.${subscriptionId},paddle_id.eq.${subscriptionId}`)
                .limit(1)
                .maybeSingle()
            ).data as { id: string } | null
          )?.id ?? null
        : null,
      amount: getTransactionAmount(data),
      currency: getTransactionCurrency(data),
      paddle_transaction_id: transactionId,
      status: getString(data, "status") ?? "completed"
    },
    { onConflict: "paddle_transaction_id" }
  );

  if (error) {
    throw new Error(`Failed to save payment: ${error.message}`);
  }

  return { skipped: false };
}

export async function POST(request: Request) {
  if (!process.env.PADDLE_WEBHOOK_SECRET || !process.env.PADDLE_API_KEY) {
    return NextResponse.json({ error: "Paddle webhook is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("paddle-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Paddle signature" }, { status: 401 });
  }

  const rawBody = await request.text();
  const paddle = createPaddleClient();
  let event: unknown;

  try {
    event = await paddle.webhooks.unmarshal(rawBody, process.env.PADDLE_WEBHOOK_SECRET, signature);
  } catch (error) {
    console.error("[billing.webhook.verify]", { message: error instanceof Error ? error.message : "Invalid signature" });
    return NextResponse.json({ error: "Invalid Paddle signature" }, { status: 401 });
  }

  const eventRecord = asRecord(event);
  const eventType = getString(eventRecord, "eventType", "event_type") ?? "unknown";
  const data = asRecord(eventRecord.data);

  try {
    if (["subscription.created", "subscription.updated", "subscription.canceled"].includes(eventType)) {
      const result = await handleSubscriptionEvent(eventType, data);
      return NextResponse.json({ received: true, eventType, ...result });
    }

    if (eventType === "transaction.completed") {
      const result = await handleTransactionCompleted(data);
      return NextResponse.json({ received: true, eventType, ...result });
    }

    return NextResponse.json({ received: true, eventType, ignored: true });
  } catch (error) {
    console.error("[billing.webhook.handle]", { eventType, message: error instanceof Error ? error.message : "Unknown webhook error" });
    return NextResponse.json({ error: "Failed to process Paddle webhook" }, { status: 500 });
  }
}
