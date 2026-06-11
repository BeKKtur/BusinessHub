import { NextResponse } from "next/server";
import { getAnalyticsData, getBusinessContext } from "@/lib/server/business-data";
import { featureUpgradeResponse, getFeatureAccess } from "@/lib/server/feature-access";

export async function GET() {
  const contextResult = await getBusinessContext();
  if (contextResult.error) {
    return NextResponse.json({ error: contextResult.error.error }, { status: contextResult.error.status });
  }

  if (!contextResult.context.e2e) {
    const access = await getFeatureAccess(contextResult.context.supabase, contextResult.context.businessId, contextResult.context.userId, "analytics");
    if (!access.allowed) return featureUpgradeResponse(access);
  }

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
