import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile/profile-form";
import { getSupabasePublicEnvStatus } from "@/lib/env";
import { planDetails, type SubscriptionPlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/types/database";

type ProfileRow = { id: string; email: string; full_name: string | null; role: ProfileRole; blocked: boolean };
type BusinessRow = { id: string; name: string; type: string };
type SubscriptionRow = { plan: SubscriptionPlan; status: string };

function roleLabel(role: ProfileRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "User";
}

export default async function ProfilePage() {
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

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, blocked")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as ProfileRow | null;
  if (!profile || profile.blocked) {
    redirect(profile?.blocked ? "/login?reason=blocked" : "/onboarding");
  }

  const { data: businessData } = await supabase
    .from("businesses")
    .select("id, name, type")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const business = businessData as BusinessRow | null;
  if (!business) {
    redirect("/onboarding");
  }

  const { data: subscriptionData } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("business_id", business.id)
    .limit(1)
    .maybeSingle();
  const subscription = subscriptionData as SubscriptionRow | null;
  const plan = subscription?.plan ?? "free";
  const subscriptionStatus = subscription?.status ?? "active";

  const details = [
    ["Email", profile.email],
    ["Роль", roleLabel(profile.role)],
    ["Бизнес", business.name],
    ["Тип бизнеса", business.type],
    ["Тариф", planDetails[plan].label],
    ["Статус подписки", subscriptionStatus]
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Профиль</h1>
          <p className="mt-1 text-sm text-muted-foreground">Данные аккаунта, бизнеса и текущей подписки.</p>
        </div>
        <Badge className="w-fit border-primary/30 bg-primary/10 text-primary">{roleLabel(profile.role)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Аккаунт</CardTitle>
          <CardDescription>Эти данные используются для доступа и отображения рабочего пространства.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-md border bg-background p-4">
                <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
                <dd className="mt-2 break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <ProfileForm
        initialValues={{
          name: profile.full_name ?? "",
          businessName: business.name,
          businessType: business.type as (typeof import("@/lib/constants").businessTypes)[number]
        }}
      />
    </div>
  );
}
