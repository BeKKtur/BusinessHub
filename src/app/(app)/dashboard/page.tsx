import { Activity, CalendarCheck, CircleDollarSign, Clock, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TD, TH, TBody, THead, TR, Table } from "@/components/ui/table";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { getDashboardData } from "@/lib/server/business-data";
import { formatLimit } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const result = await getDashboardData();

  if (result.error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Операционный центр: сегодняшние записи, клиенты, доходы и последние события." />
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Activity}
              title="Не удалось загрузить dashboard"
              description={`${result.error.error}. Проверьте авторизацию и настройки Supabase.`}
            />
          </CardContent>
        </Card>
      </>
    );
  }

  const { activity, billing, clients, clientsCount, monthRevenue, revenueSeries, services, todayAppointments, todayRevenue } = result.data;
  const clientLimit = billing.limits.clientLimit;
  const appointmentLimit = billing.limits.appointmentLimit;
  const closeToClientLimit = clientLimit !== "unlimited" && billing.usage.clients >= clientLimit * 0.8;
  const closeToAppointmentLimit = appointmentLimit !== "unlimited" && billing.usage.appointments >= appointmentLimit * 0.8;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Dashboard</h1>
            <Badge className="border-primary/30 bg-primary/10 text-primary">{billing.limits.label} plan</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Операционный центр: сегодняшние записи, клиенты, доходы и последние события.
          </p>
        </div>
        <DashboardQuickActions />
      </div>
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">План</div>
            <div className="mt-1 text-sm font-medium">{billing.limits.label} · {billing.status}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Обслуженные клиенты</div>
            <div className="mt-1 text-sm font-medium">
              {billing.usage.clients} / {formatLimit(billing.limits.clientLimit)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Завершённые записи</div>
            <div className="mt-1 text-sm font-medium">
              {billing.usage.appointments} / {formatLimit(billing.limits.appointmentLimit)}
            </div>
          </div>
        </CardContent>
      </Card>
      {closeToClientLimit || closeToAppointmentLimit ? (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-5 text-sm text-amber-700 dark:text-amber-300">
            Вы приближаетесь к лимиту тарифа {billing.limits.label}.{" "}
            {closeToClientLimit ? `Обслуженные клиенты: ${billing.usage.clients}/${formatLimit(clientLimit)}. ` : null}
            {closeToAppointmentLimit ? `Завершённые записи: ${billing.usage.appointments}/${formatLimit(appointmentLimit)}. ` : null}
            Обновите тариф, чтобы не останавливать работу.
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Сегодняшние записи", value: todayAppointments.length, icon: CalendarCheck },
          { label: "Клиенты", value: clientsCount, icon: Users },
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
            {revenueSeries.length ? (
              <RevenueChart data={revenueSeries} />
            ) : (
              <EmptyState icon={CircleDollarSign} title="Доходов пока нет" description="Добавьте первые доходы, чтобы увидеть динамику." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Последние действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="rounded-lg border bg-background p-3 text-sm">
                  {item.label}
                </div>
              ))
            ) : (
              <EmptyState icon={Activity} title="Активности пока нет" description="Созданные клиенты, услуги и записи появятся здесь." />
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Сегодняшние записи</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length ? (
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
                {todayAppointments.map((appointment) => (
                  <TR key={appointment.id}>
                    <TD>{clients.find((client) => client.id === appointment.client_id)?.name ?? "Клиент удален"}</TD>
                    <TD>{services.find((service) => service.id === appointment.service_id)?.name ?? "Услуга удалена"}</TD>
                    <TD>{new Date(appointment.starts_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</TD>
                    <TD>
                      <Badge>{appointment.status}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={CalendarCheck} title="Записей пока нет" description="Сегодняшние записи появятся здесь после создания." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
