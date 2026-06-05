import { Download, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default function FinancePage() {
  const revenue = 3700;
  const expenses = 1020;
  const profit = revenue - expenses;

  return (
    <>
      <PageHeader title="Финансы" description="Доходы, расходы, прибыль, статистика, графики и экспорт отчетов." action="Добавить операцию" />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Доходы", revenue],
          ["Расходы", expenses],
          ["Прибыль", profit]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{formatCurrency(Number(value))}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Финансовая динамика</CardTitle>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
        </CardHeader>
        <CardContent>
          <RevenueChart />
        </CardContent>
      </Card>
    </>
  );
}
