import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server/admin-auth";

export async function GET(request: Request) {
  const context = await requireSuperAdmin(request);
  if (context.error) return context.error;

  const { data, error } = await context.admin
    .from("admin_activity_logs")
    .select("id, actor_id, target_user_id, action, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[admin.activity.get]", { message: error.message });
    return NextResponse.json({ error: "Failed to load admin activity" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
