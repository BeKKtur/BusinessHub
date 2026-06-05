"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink } from "lucide-react";
import { plans } from "@/lib/constants";
import { formatApiError } from "@/lib/api-client";
import { formatLimit, planDetails, type SubscriptionPlan } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast, type ToastNotice } from "@/components/ui/toast";

const planSlugs = {
  Free: "free",
  Pro: "pro",
  Business: "business"
} as const;

type BillingStatus = {
  plan: SubscriptionPlan;
  status: string;
  paddle_id: string | null;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  paddle_price_id: string | null;
  next_billed_at: string | null;
  trial_ends_at: string | null;
  cancelled_at: string | null;
  portal_url: string | null;
};

type CheckoutResponse = {
  plan: "pro" | "business";
  priceId: string;
  transactionId: string;
  checkoutUrl: string | null;
  clientToken: string;
  environment: "sandbox" | "production";
  customerEmail: string | null;
  customData: {
    business_id: string;
    plan: "pro" | "business";
  };
  successUrl: string;
};

const fallbackBillingStatus: BillingStatus = {
  plan: "free",
  status: "active",
  paddle_id: null,
  paddle_subscription_id: null,
  paddle_customer_id: null,
  paddle_price_id: null,
  next_billed_at: null,
  trial_ends_at: null,
  cancelled_at: null,
  portal_url: null
};

declare global {
  interface Window {
    Paddle?: {
      Environment?: {
        set: (environment: "sandbox" | "production") => void;
      };
      Initialize: (options: { token: string }) => void;
      Checkout: {
        open: (
          options:
            | { transactionId: string; settings: { successUrl: string } }
            | {
                items: Array<{ priceId: string; quantity: number }>;
                customer?: { email: string };
                customData: CheckoutResponse["customData"];
                settings: { successUrl: string };
              }
        ) => void;
      };
    };
  }
}

async function fetchBillingStatus() {
  const response = await fetch("/api/billing/status");
  const payload = (await response.json().catch(() => null)) as { data?: BillingStatus; error?: string } | null;

  if (!response.ok) {
    throw new Error(formatApiError(payload, "Не удалось загрузить статус подписки"));
  }

  return payload?.data ?? fallbackBillingStatus;
}

function loadPaddleScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Paddle) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Не удалось загрузить Paddle.js")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не удалось загрузить Paddle.js"));
    document.head.appendChild(script);
  });
}

function formatDate(value: string | null) {
  if (!value) return "Не указано";
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function BillingManager() {
  const [notice, setNotice] = useState<ToastNotice | undefined>();
  const [loadingPlan, setLoadingPlan] = useState<string | undefined>();
  const [portalLoading, setPortalLoading] = useState(false);
  const statusQuery = useQuery({
    queryKey: ["billing-status"],
    queryFn: fetchBillingStatus,
    staleTime: 120_000
  });

  async function startCheckout(planName: keyof typeof planSlugs) {
    setLoadingPlan(planName);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planSlugs[planName] })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; data?: { priceId?: string } } | null;
      if (!response.ok) {
        setNotice({ type: "error", message: formatApiError(payload, "Не удалось открыть checkout") });
        return;
      }

      const checkout = payload?.data as CheckoutResponse | undefined;
      if (!checkout?.priceId || !checkout.transactionId || !checkout.clientToken) {
        setNotice({ type: "error", message: "Paddle checkout вернул неполные данные." });
        return;
      }

      await loadPaddleScript();
      if (!window.Paddle) {
        setNotice({ type: "error", message: "Paddle.js недоступен. Попробуйте еще раз." });
        return;
      }

      window.Paddle.Environment?.set(checkout.environment);
      window.Paddle.Initialize({ token: checkout.clientToken });
      try {
        window.Paddle.Checkout.open({
          transactionId: checkout.transactionId,
          settings: { successUrl: checkout.successUrl }
        });
      } catch {
        if (checkout.checkoutUrl) {
          window.location.assign(checkout.checkoutUrl);
          return;
        }

        window.Paddle.Checkout.open({
          items: [{ priceId: checkout.priceId, quantity: 1 }],
          ...(checkout.customerEmail ? { customer: { email: checkout.customerEmail } } : {}),
          customData: checkout.customData,
          settings: { successUrl: checkout.successUrl }
        });
      }
      setNotice({ type: "success", message: "Checkout открыт" });
    } finally {
      setLoadingPlan(undefined);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string; data?: { url?: string } } | null;
      if (!response.ok || !payload?.data?.url) {
        setNotice({ type: "error", message: formatApiError(payload, "Не удалось открыть управление подпиской") });
        return;
      }

      window.open(payload.data.url, "_blank", "noopener,noreferrer");
      setNotice({ type: "success", message: "Портал подписки открыт" });
    } finally {
      setPortalLoading(false);
    }
  }

  if (statusQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (statusQuery.isError) {
    return <ErrorState title={statusQuery.error instanceof Error ? statusQuery.error.message : "Не удалось загрузить billing"} />;
  }

  const currentStatus = statusQuery.data ?? fallbackBillingStatus;
  const currentPlan = planDetails[currentStatus.plan];

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      <div className="mb-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Текущий план: <span className="font-medium text-foreground">{currentPlan.label}</span>
        {" · "}
        Статус: <span className="font-medium text-foreground">{currentStatus.status}</span>
        {" · "}
        Следующее списание: <span className="font-medium text-foreground">{formatDate(currentStatus.next_billed_at)}</span>
        <div className="mt-2">
          Лимиты: клиенты {formatLimit(currentPlan.clientLimit)}, записи {formatLimit(currentPlan.appointmentLimit)}
        </div>
        <div className="mt-2">Если возникли вопросы по оплате, свяжитесь с поддержкой.</div>
        {currentStatus.plan !== "free" ? (
          <Button className="mt-4" variant="outline" onClick={openPortal} disabled={portalLoading}>
            <ExternalLink className="h-4 w-4" />
            {portalLoading ? "Открываем..." : "Управлять подпиской"}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.name === "Pro" ? "border-primary shadow-premium" : ""}>
            <CardHeader>
              <CardTitle>{plan.name === "Free" ? "Starter" : plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">/месяц</span>
              </div>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature, index) => (
                  <div key={`${feature}-${index}`} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </div>
                ))}
              </div>
              <Button
                className="mt-6 w-full"
                variant={plan.name === "Pro" ? "default" : "outline"}
                disabled={loadingPlan === plan.name || currentStatus.plan === planSlugs[plan.name] || plan.name === "Free"}
                onClick={() => startCheckout(plan.name)}
              >
                {loadingPlan === plan.name
                  ? "Открываем..."
                  : currentStatus.plan === planSlugs[plan.name]
                    ? "Текущий план"
                    : plan.name === "Free"
                      ? "Downgrade через портал"
                      : "Upgrade"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
