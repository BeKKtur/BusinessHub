import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server/admin-auth";

export async function GET(request: Request) {
  const context = await requireSuperAdmin(request);
  if (context.error) return context.error;

  const { data, error } = await context.admin
    .from("payments")
    .select("id, business_id, amount, currency, paddle_transaction_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin.revenue.get]", { message: error.message });
    return NextResponse.json({ error: "Failed to load platform revenue" }, { status: 500 });
  }

  const payments = data ?? [];
  const total = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return NextResponse.json({ data: { total, currency: "USD", payments } });
}
