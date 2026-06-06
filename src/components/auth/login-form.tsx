"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Chrome } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/api-client";
import { getClientSiteUrl } from "@/lib/site-url";

const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль")
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("reason") === "supabase"
      ? "Supabase не настроен. Заполните .env.local реальными ключами."
      : searchParams.get("error") === "oauth_callback_failed"
        ? "Не удалось завершить вход через Google. Проверьте настройки OAuth и попробуйте снова."
      : searchParams.get("reason") === "oauth"
        ? "Не удалось завершить вход через Google. Проверьте настройки OAuth и попробуйте снова."
        : searchParams.get("reason") === "oauth_existing"
          ? "Аккаунт уже существует. Выполняем вход."
        : null
  );
  const [googleLoading, setGoogleLoading] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const payload = (await response.json().catch(() => null)) as { data?: { nextPath?: string }; error?: string } | null;

    if (!response.ok) {
      setError(formatApiError(payload, "Не удалось войти"));
      return;
    }

    router.replace((payload?.data?.nextPath ?? "/dashboard") as Route);
    router.refresh();
  }

  async function onGoogleLogin() {
    console.log("Google OAuth clicked");
    setError(null);
    setGoogleLoading(true);
    try {
      const oauthStartUrl = `${getClientSiteUrl()}/auth/google`;
      console.log("Google OAuth redirectTo", `${getClientSiteUrl()}/auth/callback`);
      window.location.assign(oauthStartUrl);
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : "Не удалось открыть Google OAuth.");
      setGoogleLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Вход</CardTitle>
        <CardDescription>Войдите по email или через Google OAuth.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
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
          {error ? <ErrorState title={error} actionHref="/register" actionLabel="Создать аккаунт" /> : null}
          <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Вход..." : "Войти"}
          </Button>
          <Button className="w-full" variant="outline" type="button" onClick={onGoogleLogin}>
            <Chrome className="h-4 w-4" />
            {googleLoading ? "Аккаунт уже существует. Выполняем вход." : "Google OAuth"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link className="text-primary" href="/register">
            Регистрация
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
