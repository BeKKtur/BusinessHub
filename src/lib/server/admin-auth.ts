import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseConfigErrorResponse } from "@/lib/api";
import { isSupabaseServerConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, ProfileRole } from "@/types/database";

export const adminUserActionSchema = z.object({
  userId: z.string().uuid()
});

export const adminChangePlanSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["free", "pro", "business"]).optional(),
  grant: z.enum(["free", "pro_30", "pro_90", "business_30", "business_90", "business_forever"]).optional(),
  reason: z.enum(["Beta tester", "Partner", "Manual grant", "Refund compensation", "Other"]).default("Manual grant"),
  confirmOverwrite: z.boolean().optional()
}).refine((payload) => payload.plan || payload.grant, {
  message: "Plan or grant option is required"
});

export type AdminContext =
  | {
      admin: ReturnType<typeof createAdminClient>;
      actorId: string;
      profile: { id: string; role: ProfileRole; blocked: boolean };
      error?: never;
    }
  | { error: NextResponse };

export async function requireSuperAdmin(request?: Request): Promise<AdminContext> {
  const e2eRole = request?.headers.get("x-businesshub-e2e-role");
  if (process.env.E2E_AUTH_BYPASS === "true" && request?.headers.get("x-businesshub-e2e-auth") === "1") {
    if (!e2eRole || e2eRole === "super_admin") {
      const admin = createAdminClient();
      return { admin, actorId: "00000000-0000-0000-0000-000000000001", profile: { id: "00000000-0000-0000-0000-000000000001", role: "super_admin", blocked: false } };
    }
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (!isSupabaseServerConfigured()) {
    return { error: supabaseConfigErrorResponse() };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, blocked")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("[admin.auth.profile]", { message: profileError?.message ?? "Profile not found" });
    return { error: NextResponse.json({ error: "Admin profile not found" }, { status: 403 }) };
  }

  if (profile.role !== "super_admin" || profile.blocked) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, actorId: user.id, profile };
}

export async function logAdminAction(
  context: Exclude<AdminContext, { error: NextResponse }>,
  action: string,
  metadata: Json = {},
  targetUserId?: string
) {
  const { error } = await context.admin.from("admin_activity_logs").insert({
    actor_id: context.actorId,
    target_user_id: targetUserId ?? null,
    action,
    metadata
  });

  if (error) {
    console.error("[admin.activity.log]", { action, message: error.message });
  }
}
