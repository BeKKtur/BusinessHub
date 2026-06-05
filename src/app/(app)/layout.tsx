import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { getSupabasePublicEnvStatus } from "@/lib/env";
import type { SubscriptionPlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/types/database";

type LayoutProfile = { id: string; role: ProfileRole; blocked: boolean };
type LayoutBusiness = { id: string };
type LayoutSubscription = { plan: SubscriptionPlan; status: string; next_billed_at: string | null };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const e2eAuthBypass = process.env.E2E_AUTH_BYPASS === "true" && requestHeaders.get("x-businesshub-e2e-auth") === "1";
  let role: ProfileRole = requestHeaders.get("x-businesshub-e2e-role") === "user" ? "user" : "super_admin";
  let plan: SubscriptionPlan = "free";
  let subscriptionStatus = "active";
  let nextBilledAt: string | null = null;

  if (!e2eAuthBypass) {
    const envStatus = getSupabasePublicEnvStatus();
    if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
      redirect("/login?reason=supabase");
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: profileData } = await supabase.from("profiles").select("id, role, blocked").eq("id", user.id).maybeSingle();
    const { data: businessData } = await supabase.from("businesses").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
    const profile = profileData as LayoutProfile | null;
    const business = businessData as LayoutBusiness | null;

    if (!profile || !business) {
      redirect("/onboarding");
    }

    if (profile.blocked) {
      redirect("/login?reason=blocked");
    }

    role = profile.role;

    const { data: subscriptionData } = await supabase
      .from("subscriptions")
      .select("plan, status, next_billed_at")
      .eq("business_id", business.id)
      .limit(1)
      .maybeSingle();
    const subscription = subscriptionData as LayoutSubscription | null;

    plan = subscription?.plan ?? "free";
    subscriptionStatus = subscription?.status ?? "active";
    nextBilledAt = subscription?.next_billed_at ?? null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <Sidebar role={role} plan={plan} subscriptionStatus={subscriptionStatus} nextBilledAt={nextBilledAt} />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
