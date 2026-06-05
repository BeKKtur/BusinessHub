import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAnalyticsData } from "@/lib/server/business-data";

export default async function AnalyticsPage() {
  const result = await getAnalyticsData();

  if (result.error) {
    return (
      <>
        <PageHeader title="Аналитика" description="Новые и повторные клиенты, прибыльные услуги, доход по месяцам и конверсия записей." />
        <Card>
          <CardContent className="pt-6">
            <EmptyState icon={BarChart3} title="Не удалось загрузить аналитику" description={result.error.error} />
          </CardContent>
        </Card>
      </>
    );
  }

  const { bookingConversion, newClients, repeatClientsRate, revenueSeries, topService } = result.data;
  const metrics = [
    ["Новые клиенты", String(newClients)],
    ["Повторные клиенты", `${repeatClientsRate}%`],
    ["Самая прибыльная услуга", topService],
    ["Конверсия записей", `${bookingConversion}%`]
  ];

  return (
    <>
      <PageHeader title="Аналитика" description="Новые и повторные клиенты, прибыльные услуги, доход по месяцам и конверсия записей." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value], index) => (
          <Card key={`${label}-${index}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Доход по месяцам</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueSeries.length ? (
            <RevenueChart data={revenueSeries} />
          ) : (
            <EmptyState icon={BarChart3} title="Аналитики пока нет" description="Создайте клиентов, записи и доходы, чтобы увидеть показатели." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
