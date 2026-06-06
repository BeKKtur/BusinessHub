import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { planDetails, type SubscriptionPlan } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type BillingStatus = {
  user_id: string | null;
  plan: SubscriptionPlan;
  status: string;
  paddle_id: string | null;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  paddle_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billed_at: string | null;
  trial_ends_at: string | null;
  cancelled_at: string | null;
  portal_url: string | null;
};

type SupabaseLike = {
  from: (table: string) => unknown;
};

type PaddlePortalSession = {
  urls: {
    general: { overview: string };
    subscriptions: Array<{ updateSubscriptionPaymentMethod: string }>;
  };
};

type PaddleClient = InstanceType<typeof Paddle>;

type LegacyPaddleClient = {
  webhooks: {
    unmarshal: (rawBody: string, secret: string, signature: string) => Promise<unknown>;
  };
  customerPortalSessions: {
    create: (customerId: string, subscriptionIds: string[]) => Promise<PaddlePortalSession>;
  };
  transactions: {
    create: (
      payload: {
        items: Array<{ priceId: string; quantity: number }>;
        customData?: Record<string, string>;
      },
      query?: { include?: string[] }
    ) => Promise<{
      id: string;
      status: string;
      checkout: { url: string | null } | null;
      customerId: string | null;
      subscriptionId: string | null;
    }>;
  };
};

type QueryError = { message: string };
type MaybeSingleResult = Promise<{ data: unknown; error: QueryError | null }>;
type CountResult = Promise<{ count: number | null; error: QueryError | null }>;
type SubscriptionTable = {
  select: (columns: string) => {
    eq: (column: "business_id", value: string) => {
      limit: (count: number) => {
        maybeSingle: () => MaybeSingleResult;
      };
    };
  };
};
type SubscriptionInsertTable = {
  insert: (payload: { business_id: string; plan: "free"; status: "active" }) => MaybeSingleResult;
};
type BusinessOwnerTable = {
  select: (columns: string) => {
    eq: (column: "id", value: string) => {
      limit: (count: number) => {
        maybeSingle: () => MaybeSingleResult;
      };
    };
  };
};
type CountTable = {
  select: (columns: string, options: { count: "exact"; head: true }) => {
    eq: (column: "business_id", value: string) => CountResult;
  };
};

export const checkoutPlans = ["pro", "business"] as const;
export type CheckoutPlan = (typeof checkoutPlans)[number];

export function isCheckoutPlan(plan: SubscriptionPlan): plan is CheckoutPlan {
  return plan === "pro" || plan === "business";
}

export function getPaddleEnvironmentName() {
  return process.env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function getPaddleEnvironment() {
  return getPaddleEnvironmentName() === "production" ? Environment.production : Environment.sandbox;
}

export function createPaddleClient() {
  if (!process.env.PADDLE_API_KEY) {
    throw new Error("PADDLE_API_KEY is not configured");
  }

  return new Paddle(process.env.PADDLE_API_KEY, {
    environment: getPaddleEnvironment()
  }) as PaddleClient & LegacyPaddleClient;
}

export type PaddleCheckoutTransaction = {
  id: string;
  status: string;
  checkout: { url: string | null } | null;
  customerId: string | null;
  subscriptionId: string | null;
};

type PaddleTransactionResponse = {
  data?: {
    id?: string;
    status?: string;
    checkout?: { url?: string | null } | null;
    customer_id?: string | null;
    subscription_id?: string | null;
  };
  error?: unknown;
  errors?: unknown;
  detail?: string;
  type?: string;
  code?: string;
};

function getPaddleApiBaseUrl() {
  return getPaddleEnvironmentName() === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

export async function createPaddleCheckoutTransaction(payload: {
  priceId: string;
  quantity: number;
  customData: Record<string, string>;
}): Promise<PaddleCheckoutTransaction> {
  if (!process.env.PADDLE_API_KEY) {
    throw new Error("PADDLE_API_KEY is not configured");
  }

  const requestBody = {
    items: [{ price_id: payload.priceId, quantity: payload.quantity }],
    collection_mode: "automatic",
    custom_data: payload.customData
  };

  const response = await fetch(`${getPaddleApiBaseUrl()}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  const rawBody = await response.text();
  let body: PaddleTransactionResponse | null = null;
  try {
    body = rawBody ? (JSON.parse(rawBody) as PaddleTransactionResponse) : null;
  } catch {
    body = null;
  }
  const transaction = body?.data;

  if (!response.ok || !transaction?.id) {
    console.error("[billing.checkout.paddle.rest]", {
      status: response.status,
      responseBody: rawBody,
      requestBody: {
        ...requestBody,
        items: requestBody.items.map((item) => ({
          ...item,
          price_id: `${item.price_id.slice(0, 8)}…${item.price_id.slice(-6)}`
        }))
      }
    });
    const error = new Error(body?.detail || `Paddle transaction request failed with status ${response.status}`);
    Object.assign(error, {
      status: response.status,
      code: body?.code,
      type: body?.type,
      detail: body?.detail,
      errors: body?.errors ?? body?.error,
      responseBody: rawBody
    });
    throw error;
  }

  return {
    id: transaction.id,
    status: transaction.status ?? "unknown",
    checkout: transaction.checkout ? { url: transaction.checkout.url ?? null } : null,
    customerId: transaction.customer_id ?? null,
    subscriptionId: transaction.subscription_id ?? null
  };
}

export function getPriceIdForPlan(plan: CheckoutPlan) {
  return plan === "pro" ? process.env.PADDLE_PRO_PRICE_ID : process.env.PADDLE_BUSINESS_PRICE_ID;
}

export function getPlanByPriceId(priceId?: string | null): SubscriptionPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.PADDLE_PRO_PRICE_ID) return "pro";
  if (priceId === process.env.PADDLE_BUSINESS_PRICE_ID) return "business";
  return null;
}

export function getMissingPaddleEnv(plan?: CheckoutPlan) {
  const required = ["PADDLE_API_KEY", "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"] as const;
  const missing = required.filter((key) => !process.env[key]);
  const missingEnv: string[] = [...missing];
  const priceId = plan ? getPriceIdForPlan(plan) : process.env.PADDLE_PRO_PRICE_ID || process.env.PADDLE_BUSINESS_PRICE_ID;

  if (plan && !priceId) {
    missingEnv.push(plan === "pro" ? "PADDLE_PRO_PRICE_ID" : "PADDLE_BUSINESS_PRICE_ID");
  }

  return missingEnv;
}

export function paddleConfigError(missingEnv: string[]) {
  return NextResponse.json(
    {
      error: `Paddle is not configured: ${missingEnv.join(", ")}`,
      missingEnv,
      setup:
        "Add Paddle API key, client token and price ids to .env.local. Create products/prices in Paddle Dashboard and copy price ids."
    },
    { status: 503 }
  );
}

export function subscriptionDefaults(subscription?: Partial<BillingStatus> | null): BillingStatus {
  return {
    user_id: subscription?.user_id ?? null,
    plan: subscription?.plan ?? "free",
    status: subscription?.status ?? "active",
    paddle_id: subscription?.paddle_id ?? null,
    paddle_subscription_id: subscription?.paddle_subscription_id ?? null,
    paddle_customer_id: subscription?.paddle_customer_id ?? null,
    paddle_price_id: subscription?.paddle_price_id ?? null,
    current_period_start: subscription?.current_period_start ?? null,
    current_period_end: subscription?.current_period_end ?? null,
    next_billed_at: subscription?.next_billed_at ?? null,
    trial_ends_at: subscription?.trial_ends_at ?? null,
    cancelled_at: subscription?.cancelled_at ?? null,
    portal_url: subscription?.portal_url ?? null
  };
}

async function createFreeSubscriptionIfMissing(businessId: string) {
  const admin = createAdminClient();
  const businessTable = admin.from("businesses") as unknown as BusinessOwnerTable;
  const { data: business, error: businessError } = await businessTable
    .select("owner_id")
    .eq("id", businessId)
    .limit(1)
    .maybeSingle();

  if (businessError || !business) {
    console.warn("[billing.subscription.provision]", {
      businessId,
      message: businessError?.message ?? "Business not found. Free fallback returned without insert."
    });
    return subscriptionDefaults();
  }

  const subscriptionTable = admin.from("subscriptions") as unknown as SubscriptionInsertTable;
  const { error } = await subscriptionTable.insert({
    business_id: businessId,
    plan: "free",
    status: "active"
  });

  if (error) {
    console.warn("[billing.subscription.provision]", {
      businessId,
      message: error.message
    });
    return subscriptionDefaults();
  }

  console.info("[billing.subscription.provision]", {
    businessId,
    ownerId: (business as { owner_id?: string }).owner_id ?? null,
    plan: "free",
    message: "Free subscription created because no subscription row existed."
  });

  return subscriptionDefaults({ plan: "free", status: "active" });
}

export async function getBusinessSubscription(supabase: SupabaseLike, businessId: string): Promise<BillingStatus> {
  const table = supabase.from("subscriptions") as SubscriptionTable;
  const { data, error } = await table
    .select(
      "plan, status, paddle_id, paddle_subscription_id, paddle_customer_id, paddle_price_id, current_period_end, next_billed_at, trial_ends_at, cancelled_at, portal_url"
    )
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[billing.subscription.fallback]", {
      businessId,
      message: error.message,
      fallbackPlan: "free"
    });
    return subscriptionDefaults();
  }

  if (!data) {
    return createFreeSubscriptionIfMissing(businessId);
  }

  const subscription = subscriptionDefaults(data as Partial<BillingStatus> | null);
  console.info("[billing.subscription.read]", {
    businessId,
    plan: subscription.plan,
    status: subscription.status,
    hasPaddleSubscription: Boolean(subscription.paddle_subscription_id)
  });
  return subscription;
}

async function countRows(supabase: SupabaseLike, table: string, businessId: string) {
  const query = supabase.from(table) as CountTable;
  const { count, error } = await query.select("id", { count: "exact", head: true }).eq("business_id", businessId);

  if (error) {
    console.error("[billing.limits.count]", { table, message: error.message });
    throw new Error("Failed to check plan limits");
  }

  return count ?? 0;
}

export async function enforcePlanLimit(
  supabase: SupabaseLike,
  businessId: string,
  resource: "clients" | "appointments"
): Promise<NextResponse | null> {
  const subscription = await getBusinessSubscription(supabase, businessId);
  const limits = planDetails[subscription.plan];
  const limit = resource === "clients" ? limits.clientLimit : limits.appointmentLimit;

  if (limit === "unlimited") {
    return null;
  }

  const currentCount = await countRows(supabase, resource, businessId);
  if (currentCount < limit) {
    return null;
  }

  const resourceLabel = resource === "clients" ? "клиентов" : "записей";
  return NextResponse.json(
    {
      error: `Достигнут лимит тарифа ${limits.label}: ${limit} ${resourceLabel}. Перейдите на более высокий тариф, чтобы продолжить.`,
      code: "PLAN_LIMIT_REACHED",
      upgradeRequired: true,
      plan: subscription.plan,
      limit,
      currentCount
    },
    { status: 402 }
  );
}

export type SubscriptionUpsert = Database["public"]["Tables"]["subscriptions"]["Update"] & {
  business_id: string;
};
