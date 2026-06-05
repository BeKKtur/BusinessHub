import { NextResponse } from "next/server";
import { revenueSeries } from "@/lib/mock-data";
import { requireAuth } from "@/lib/api";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  return NextResponse.json({
    data: {
      new_clients: 32,
      repeat_clients_rate: 68,
      top_services: ["Окрашивание", "Стрижка и укладка"],
      booking_conversion: 84,
      revenue_by_month: revenueSeries
    }
  });
}
