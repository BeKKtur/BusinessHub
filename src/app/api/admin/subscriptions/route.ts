import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server/admin-auth";

export async function GET(request: Request) {
  const context = await requireSuperAdmin(request);
  if (context.error) return context.error;

  const { data, error } = await context.admin
    .from("subscriptions")
    .select("id, business_id, plan, status, paddle_id, paddle_subscription_id, paddle_customer_id, paddle_price_id, next_billed_at")
    .order("status", { ascending: true });

  if (error) {
    console.error("[admin.subscriptions.get]", { message: error.message });
    return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
