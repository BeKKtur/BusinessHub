import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
  const metrics = [
    ["Новые клиенты", "32"],
    ["Повторные клиенты", "68%"],
    ["Самая прибыльная услуга", "Окрашивание"],
    ["Конверсия записей", "84%"]
  ];

  return (
    <>
      <PageHeader title="Аналитика" description="Новые и повторные клиенты, прибыльные услуги, доход по месяцам и конверсия записей." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label}>
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
          <RevenueChart />
        </CardContent>
      </Card>
    </>
  );
}
