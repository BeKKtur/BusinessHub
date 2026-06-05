import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server/admin-auth";

export async function GET(request: Request) {
  const context = await requireSuperAdmin(request);
  if (context.error) return context.error;

  const { data, error } = await context.admin
    .from("businesses")
    .select("id, owner_id, name, type, timezone, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin.businesses.get]", { message: error.message });
    return NextResponse.json({ error: "Failed to load businesses" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
