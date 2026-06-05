import { NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/server/business-data";

export async function GET() {
  const result = await getAnalyticsData();

  if (result.error) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  return NextResponse.json({
    data: {
      new_clients: result.data.newClients,
      repeat_clients_rate: result.data.repeatClientsRate,
      top_services: result.data.topServices,
      booking_conversion: result.data.bookingConversion,
      revenue_by_month: result.data.revenueSeries
    }
  });
}
