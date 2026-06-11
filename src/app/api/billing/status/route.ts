import { NextResponse } from "next/server";
import { getSupabaseEnvStatus, supabaseConfigErrorResponse } from "@/lib/api";
import { getBusinessSubscription } from "@/lib/server/billing";
import { createClient } from "@/lib/supabase/server";

type BillingBusiness = { id: string };
type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paddle_transaction_id: string;
  created_at: string;
};

export async function GET() {
  const envStatus = getSupabaseEnvStatus();
  if (envStatus.missingEnv.length || envStatus.placeholderEnv.length || envStatus.invalidEnv.length) {
    return supabaseConfigErrorResponse();
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: businessData, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();
  const business = businessData as BillingBusiness | null;

  if (businessError || !business) {
    return NextResponse.json({ error: "Business workspace not found" }, { status: 404 });
  }

  try {
    const subscription = await getBusinessSubscription(supabase, business.id);
    const [paymentsResult] = await Promise.all([
      supabase
        .from("payments")
        .select("id, amount, currency, status, paddle_transaction_id, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    if (paymentsResult.error) {
      console.error("[billing.status.payments]", { message: paymentsResult.error.message });
      return NextResponse.json({ error: "Failed to load payment history" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        ...subscription,
        usage: {
          clients: subscription.served_clients_count,
          appointments: subscription.completed_appointments_count
        },
        payments: (paymentsResult.data ?? []) as PaymentRow[]
      }
    });
  } catch (error) {
    console.error("[billing.status]", { message: error instanceof Error ? error.message : "Unknown billing status error" });
    return NextResponse.json({ error: "Failed to load subscription status" }, { status: 500 });
  }
}
