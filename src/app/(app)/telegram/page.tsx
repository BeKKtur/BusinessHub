import { PageHeader } from "@/components/app/page-header";
import { FeatureUpgradeCard } from "@/components/billing/feature-upgrade-card";
import { TelegramManager } from "@/components/telegram/telegram-manager";
import { getBusinessContext } from "@/lib/server/business-data";
import { getFeatureAccess } from "@/lib/server/feature-access";

export default async function TelegramPage() {
  const { context, error } = await getBusinessContext();

  if (error) {
    return (
      <>
        <PageHeader title="Telegram" description="Подключение Telegram Bot API, напоминания клиентам и уведомления владельцу." />
        <FeatureUpgradeCard title="Telegram недоступен" description={error.error} />
      </>
    );
  }

  if (!context.e2e) {
    const access = await getFeatureAccess(context.supabase, context.businessId, context.userId, "telegram");
    if (!access.allowed) {
      return (
        <>
          <PageHeader title="Telegram" description="Подключение Telegram Bot API, напоминания клиентам и уведомления владельцу." />
          <FeatureUpgradeCard title={access.title} description={access.description} />
        </>
      );
    }
  }

  return (
    <>
      <PageHeader title="Telegram" description="Подключение Telegram Bot API, напоминания клиентам и уведомления владельцу." />
      <TelegramManager />
    </>
  );
}
