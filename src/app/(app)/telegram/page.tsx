import { PageHeader } from "@/components/app/page-header";
import { TelegramManager } from "@/components/telegram/telegram-manager";

export default function TelegramPage() {
  return (
    <>
      <PageHeader title="Telegram" description="Подключение Telegram Bot API, напоминания клиентам и уведомления владельцу." />
      <TelegramManager />
    </>
  );
}
