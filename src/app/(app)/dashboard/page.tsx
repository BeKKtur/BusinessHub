import { CalendarCheck, CircleDollarSign, Clock, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TD, TH, TBody, THead, TR, Table } from "@/components/ui/table";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { activity, appointments, clients, services } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const todayRevenue = 105;
  const monthRevenue = 1260;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Операционный центр: сегодняшние записи, клиенты, доходы и последние события."
        action="Быстрое действие"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Сегодняшние записи", value: appointments.length, icon: CalendarCheck },
          { label: "Клиенты", value: clients.length, icon: Users },
          { label: "Доход сегодня", value: formatCurrency(todayRevenue), icon: CircleDollarSign },
          { label: "Доход за месяц", value: formatCurrency(monthRevenue), icon: Clock }
        ].map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{metric.value}</div>
              <Skeleton className="mt-4 h-2 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Доход и прибыль</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Последние действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.map((item) => (
              <div key={item} className="rounded-lg border bg-background p-3 text-sm">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Сегодняшние записи</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Клиент</TH>
                <TH>Услуга</TH>
                <TH>Время</TH>
                <TH>Статус</TH>
              </TR>
            </THead>
            <TBody>
              {appointments.map((appointment) => (
                <TR key={appointment.id}>
                  <TD>{clients.find((client) => client.id === appointment.client_id)?.name}</TD>
                  <TD>{services.find((service) => service.id === appointment.service_id)?.name}</TD>
                  <TD>{new Date(appointment.starts_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</TD>
                  <TD>
                    <Badge>{appointment.status}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
