import { headers } from "next/headers";
import { PageHeader } from "@/components/app/page-header";
import { AdminAccessDenied } from "@/components/admin/admin-access-denied";
import { AdminManager } from "@/components/admin/admin-manager";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/types/database";

type AdminPageProfile = { role: ProfileRole; blocked: boolean };

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ e2e_role?: string }> }) {
  const requestHeaders = await headers();
  const params = searchParams ? await searchParams : {};
  const e2eAuthBypass = process.env.E2E_AUTH_BYPASS === "true" && requestHeaders.get("x-businesshub-e2e-auth") === "1";
  let allowed = false;

  if (e2eAuthBypass) {
    allowed = (params.e2e_role ?? requestHeaders.get("x-businesshub-e2e-role")) !== "user";
  } else {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profileData } = await supabase.from("profiles").select("role, blocked").eq("id", user.id).maybeSingle();
      const profile = profileData as AdminPageProfile | null;
      allowed = profile?.role === "super_admin" && !profile.blocked;
    }
  }

  return (
    <>
      <PageHeader title="Admin Panel" description="Пользователи, бизнесы, подписки, активность и логи платформы." />
      {allowed ? <AdminManager /> : <AdminAccessDenied />}
    </>
  );
}
