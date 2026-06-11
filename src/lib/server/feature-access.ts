import { NextResponse } from "next/server";
import { getBusinessSubscription } from "@/lib/server/billing";
import type { SubscriptionPlan } from "@/lib/plans";
import type { ProfileRole } from "@/types/database";

export type PaidFeature = "finance" | "analytics" | "telegram";

type QueryError = { message: string };
type QueryResult<T> = Promise<{ data: T | null; error: QueryError | null }>;
type SupabaseFeatureClient = {
  from: (table: string) => unknown;
};
type ProfilesTable = {
  select: (columns: string) => {
    eq: (column: "id", value: string) => {
      maybeSingle: () => QueryResult<{ role: ProfileRole; blocked: boolean }>;
    };
  };
};

const planRank: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 1,
  business: 2
};

export const featureRequirements: Record<
  PaidFeature,
  {
    requiredPlan: Exclude<SubscriptionPlan, "free">;
    title: string;
    description: string;
  }
> = {
  finance: {
    requiredPlan: "pro",
    title: "Финансы доступны на Pro",
    description: "Доходы, расходы, прибыль и экспорт финансовых отчетов доступны на тарифах Pro и Business."
  },
  analytics: {
    requiredPlan: "pro",
    title: "Аналитика доступна на Pro",
    description: "Повторные клиенты, прибыльные услуги, доход по месяцам и конверсия записей доступны на тарифах Pro и Business."
  },
  telegram: {
    requiredPlan: "business",
    title: "Telegram-автоматизация доступна на Business",
    description: "Telegram Bot API, напоминания за 24 часа и за 2 часа доступны только на тарифе Business."
  }
};

export function canAccessFeature(options: { feature: PaidFeature; plan: SubscriptionPlan; role?: ProfileRole }) {
  if (options.role === "super_admin") return true;
  const requiredPlan = featureRequirements[options.feature].requiredPlan;
  return planRank[options.plan] >= planRank[requiredPlan];
}

export async function getFeatureAccess(
  supabase: SupabaseFeatureClient,
  businessId: string,
  userId: string,
  feature: PaidFeature
) {
  const [{ data: profile, error: profileError }, subscription] = await Promise.all([
    (supabase.from("profiles") as ProfilesTable).select("role, blocked").eq("id", userId).maybeSingle(),
    getBusinessSubscription(supabase, businessId)
  ]);

  if (profileError) {
    console.warn("[feature-access.profile]", { feature, message: profileError.message });
  }

  const role = profile?.role ?? "user";
  const allowed = !profile?.blocked && canAccessFeature({ feature, plan: subscription.plan, role });

  return {
    allowed,
    feature,
    role,
    plan: subscription.plan,
    status: subscription.status,
    ...featureRequirements[feature]
  };
}

export function featureUpgradeResponse(access: Awaited<ReturnType<typeof getFeatureAccess>>) {
  return NextResponse.json(
    {
      error: access.description,
      code: "FEATURE_UPGRADE_REQUIRED",
      upgradeRequired: true,
      feature: access.feature,
      plan: access.plan,
      requiredPlan: access.requiredPlan
    },
    { status: 402 }
  );
}
