import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TD, TH, TBody, THead, TR, Table } from "@/components/ui/table";

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Admin Panel" description="Пользователи, подписки, доход платформы, активность и логи." />
      <div className="grid gap-4 md:grid-cols-4">
        {["Пользователи: 128", "MRR: $2,840", "Активность: 91%", "Ошибки: 0"].map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {item}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Логи платформы</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Событие</TH>
                <TH>Пользователь</TH>
                <TH>Время</TH>
              </TR>
            </THead>
            <TBody>
              {[
                ["subscription.updated", "owner@salon.com", "10:40"],
                ["telegram.sent", "admin@barber.com", "10:17"],
                ["payment.completed", "owner@wash.com", "09:55"]
              ].map(([event, user, time]) => (
                <TR key={event}>
                  <TD>{event}</TD>
                  <TD>{user}</TD>
                  <TD>{time}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
