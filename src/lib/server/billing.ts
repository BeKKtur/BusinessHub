import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { planDetails, type SubscriptionPlan } from "@/lib/plans";
import type { Database } from "@/types/database";

export type BillingStatus = {
  plan: SubscriptionPlan;
  status: string;
  paddle_id: string | null;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  paddle_price_id: string | null;
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

type PaddleClient = {
  webhooks: {
    unmarshal: (rawBody: string, secret: string, signature: string) => Promise<unknown>;
  };
  customerPortalSessions: {
    create: (customerId: string, subscriptionIds: string[]) => Promise<PaddlePortalSession>;
  };
};

type PaddleSdk = {
  Environment: {
    production: unknown;
    sandbox: unknown;
  };
  Paddle: new (apiKey: string, options: { environment: unknown }) => PaddleClient;
};

const serverRequire = createRequire(import.meta.url);

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

function loadPaddleSdk() {
  const packageName = "@paddle/paddle-node-sdk";
  return serverRequire(packageName) as PaddleSdk;
}

export function getPaddleEnvironmentName() {
  return process.env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function getPaddleEnvironment() {
  const sdk = loadPaddleSdk();
  return getPaddleEnvironmentName() === "production" ? sdk.Environment.production : sdk.Environment.sandbox;
}

export function createPaddleClient() {
  if (!process.env.PADDLE_API_KEY) {
    throw new Error("PADDLE_API_KEY is not configured");
  }

  const sdk = loadPaddleSdk();
  return new sdk.Paddle(process.env.PADDLE_API_KEY, {
    environment: getPaddleEnvironment()
  });
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
    plan: subscription?.plan ?? "free",
    status: subscription?.status ?? "active",
    paddle_id: subscription?.paddle_id ?? null,
    paddle_subscription_id: subscription?.paddle_subscription_id ?? null,
    paddle_customer_id: subscription?.paddle_customer_id ?? null,
    paddle_price_id: subscription?.paddle_price_id ?? null,
    next_billed_at: subscription?.next_billed_at ?? null,
    trial_ends_at: subscription?.trial_ends_at ?? null,
    cancelled_at: subscription?.cancelled_at ?? null,
    portal_url: subscription?.portal_url ?? null
  };
}

export async function getBusinessSubscription(supabase: SupabaseLike, businessId: string): Promise<BillingStatus> {
  const table = supabase.from("subscriptions") as SubscriptionTable;
  const { data, error } = await table
    .select(
      "plan, status, paddle_id, paddle_subscription_id, paddle_customer_id, paddle_price_id, next_billed_at, trial_ends_at, cancelled_at, portal_url"
    )
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[billing.subscription]", { message: error.message });
    throw new Error("Failed to load subscription status");
  }

  return subscriptionDefaults(data as Partial<BillingStatus> | null);
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
      error: `Достигнут лимит тарифа Free: ${limit} ${resourceLabel}. Перейдите на Pro или Business, чтобы продолжить.`,
      code: "PLAN_LIMIT_REACHED",
      upgradeRequired: true,
      limit,
      currentCount
    },
    { status: 402 }
  );
}

export type SubscriptionUpsert = Database["public"]["Tables"]["subscriptions"]["Update"] & {
  business_id: string;
};
