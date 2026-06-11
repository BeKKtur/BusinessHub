import { PageHeader } from "@/components/app/page-header";
import { FeatureUpgradeCard } from "@/components/billing/feature-upgrade-card";
import { FinanceManager } from "@/components/finance/finance-manager";
import { getFeatureAccess } from "@/lib/server/feature-access";
import { getBusinessContext } from "@/lib/server/business-data";

export default async function FinancePage() {
  const { context, error } = await getBusinessContext();

  if (error) {
    return (
      <>
        <PageHeader title="Финансы" description="Доходы, расходы, прибыль и экспорт отчетов." />
        <FeatureUpgradeCard title="Финансы недоступны" description={error.error} />
      </>
    );
  }

  if (!context.e2e) {
    const access = await getFeatureAccess(context.supabase, context.businessId, context.userId, "finance");
    if (!access.allowed) {
      return (
        <>
          <PageHeader title="Финансы" description="Доходы, расходы, прибыль и экспорт отчетов." />
          <FeatureUpgradeCard title={access.title} description={access.description} />
        </>
      );
    }
  }

  return <FinanceManager />;
}
