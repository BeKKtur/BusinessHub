"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { motion } from "framer-motion";
import { useState } from "react";
import { businessTypes } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";

export function OnboardingForm() {
  const router = useRouter();
  const { businessType, setBusinessType } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveBusinessType() {
    setIsSaving(true);
    setError(null);
    const response = await fetch("/api/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessType })
    });
    const payload = (await response.json().catch(() => null)) as { data?: { nextPath?: string }; error?: string } | null;
    setIsSaving(false);

    if (!response.ok) {
      setError(formatApiError(payload, "Не удалось сохранить настройки бизнеса"));
      return;
    }

    router.replace((payload?.data?.nextPath ?? "/dashboard") as Route);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Выберите тип бизнеса</CardTitle>
        <CardDescription>Dashboard и шаблоны будут адаптированы под вашу нишу.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {businessTypes.map((type) => (
            <motion.button
              key={type}
              whileHover={{ y: -2 }}
              className={cn(
                "rounded-lg border p-4 text-left text-sm font-medium transition-colors",
                businessType === type ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
              )}
              onClick={() => setBusinessType(type)}
              type="button"
            >
              {type}
            </motion.button>
          ))}
        </div>
        {error ? <div className="mt-4"><ErrorState title={error} /></div> : null}
        <Button className="mt-6 w-full" onClick={saveBusinessType} disabled={isSaving}>
          {isSaving ? "Сохранение..." : "Открыть BusinessHub"}
        </Button>
      </CardContent>
    </Card>
  );
}
