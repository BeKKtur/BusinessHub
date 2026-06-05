"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { zodResolver } from "@hookform/resolvers/zod";
import { Chrome } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { businessTypes } from "@/lib/constants";
import { formatApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Введите имя"),
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
  businessName: z.string().trim().min(2, "Введите название бизнеса"),
  businessType: z.string().trim().min(1)
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      businessName: "",
      businessType: businessTypes[0] ?? "Другое"
    }
  });

  async function onSubmit(values: RegisterValues) {
    setError(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const payload = (await response.json().catch(() => null)) as { data?: { nextPath?: string }; error?: string } | null;

    if (!response.ok || payload?.error) {
      setError(formatApiError(payload, "Не удалось создать аккаунт"));
      return;
    }

    router.replace((payload?.data?.nextPath ?? "/onboarding") as Route);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Регистрация</CardTitle>
        <CardDescription>Создайте рабочее пространство BusinessHub.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" placeholder="Азамат" {...form.register("name")} />
            {form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessName">Название бизнеса</Label>
            <Input id="businessName" placeholder="Aza Studio" {...form.register("businessName")} />
            {form.formState.errors.businessName ? (
              <p className="text-xs text-destructive">{form.formState.errors.businessName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessType">Тип бизнеса</Label>
            <select
              id="businessType"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("businessType")}
            >
              {businessTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="owner@business.com" {...form.register("email")} />
            {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          {error ? <ErrorState title={error} actionHref="/login" actionLabel="Войти" /> : null}
          <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Создание..." : "Создать аккаунт"}
          </Button>
          <Button className="w-full" variant="outline" type="button" disabled>
            <Chrome className="h-4 w-4" />
            Google OAuth
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
