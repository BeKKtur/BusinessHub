import { Check } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { plans } from "@/lib/constants";

export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing" description="Тарифы Free, Pro и Business с оплатой через Paddle." />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.name === "Pro" ? "border-primary shadow-premium" : ""}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">/месяц</span>
              </div>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </div>
                ))}
              </div>
              <Button className="mt-6 w-full" variant={plan.name === "Pro" ? "default" : "outline"}>
                Выбрать
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
