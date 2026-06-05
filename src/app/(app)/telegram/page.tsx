import { Bot, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TelegramPage() {
  return (
    <>
      <PageHeader title="Telegram" description="Подключение Telegram Bot API, напоминания клиентам и уведомления владельцу." />
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Подключение бота
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot-token">Bot Token</Label>
              <Input id="bot-token" placeholder="123456:telegram-token" />
            </div>
            <Button>Подключить Telegram</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Автоматизации</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Напоминание клиенту за день", "Напоминание клиенту за 2 часа", "Уведомление владельцу"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-lg border bg-background p-4">
                <span className="text-sm font-medium">{item}</span>
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
