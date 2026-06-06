import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  {
    name: "Starter",
    price: "$0/month",
    features: ["До 50 клиентов", "До 100 записей", "Базовый CRM dashboard", "Клиенты, услуги и расписание"]
  },
  {
    name: "Pro",
    price: "$10/month",
    features: ["Безлимитные клиенты", "Безлимитные записи", "Финансовая аналитика", "Отчеты по доходам и расходам"]
  },
  {
    name: "Business",
    price: "$20/month",
    features: ["Все возможности Pro", "Расширенная аналитика", "Telegram automation", "Напоминания клиентам и владельцу"]
  }
] as const;

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link className="text-sm font-semibold" href="/">
            BusinessHub
          </Link>
          <Button asChild>
            <Link href="/register">Create account</Link>
          </Button>
        </div>

        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">BusinessHub Pricing</h1>
          <p className="mt-4 text-muted-foreground">
            BusinessHub is a CRM for service businesses that need clients, appointments, services, finance analytics
            and Telegram reminders in one workspace.
          </p>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="text-3xl font-semibold">{plan.price}</div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
