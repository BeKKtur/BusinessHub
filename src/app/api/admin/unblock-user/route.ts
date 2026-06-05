import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api";
import { adminUserActionSchema, logAdminAction, requireSuperAdmin } from "@/lib/server/admin-auth";

export async function POST(request: Request) {
  try {
    const context = await requireSuperAdmin(request);
    if (context.error) return context.error;

    const payload = await parseJson(request, adminUserActionSchema);
    const { data, error } = await context.admin
      .from("profiles")
      .update({ blocked: false })
      .eq("id", payload.userId)
      .select("id, email, full_name, role, blocked, created_at")
      .single();

    if (error || !data) {
      console.error("[admin.unblock-user]", { message: error?.message ?? "No row returned" });
      return NextResponse.json({ error: "Failed to unblock user" }, { status: 500 });
    }

    await logAdminAction(context, "unblock_user", { email: data.email }, payload.userId);
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
