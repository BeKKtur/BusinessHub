"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Send, ShieldCheck, TestTube2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatApiError } from "@/lib/api-client";
import { telegramSettingsSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast, type ToastNotice } from "@/components/ui/toast";

type TelegramSettingsForm = z.infer<typeof telegramSettingsSchema>;

type TelegramSettings = TelegramSettingsForm & {
  connected: boolean;
  last_test_sent_at: string | null;
};

type TelegramAction =
  | { action: "save"; settings: TelegramSettingsForm }
  | { action: "test_token"; bot_token: string }
  | { action: "send_test"; bot_token: string; chat_id: string };

const defaultSettings: TelegramSettings = {
  bot_token: "",
  chat_id: "",
  enabled: false,
  reminder_24h: true,
  reminder_2h: true,
  connected: false,
  last_test_sent_at: null
};

async function readTelegramSettings() {
  const response = await fetch("/api/telegram");
  const payload = (await response.json().catch(() => null)) as { data?: TelegramSettings; error?: string } | null;

  if (!response.ok) {
    throw new Error(formatApiError(payload, "Не удалось загрузить настройки Telegram"));
  }

  return payload?.data ?? defaultSettings;
}

async function postTelegramAction(action: TelegramAction) {
  const response = await fetch("/api/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action)
  });
  const payload = (await response.json().catch(() => null)) as { data?: TelegramSettings | unknown; error?: string } | null;

  if (!response.ok) {
    throw new Error(formatApiError(payload, "Не удалось выполнить действие Telegram"));
  }

  return payload?.data;
}

function formatDateTime(value: string | null) {
  if (!value) return "Тестовое сообщение еще не отправлялось";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function checkboxClass() {
  return "h-4 w-4 rounded border-input accent-primary";
}

export function TelegramManager() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<ToastNotice | undefined>();
  const form = useForm<TelegramSettingsForm>({
    resolver: zodResolver(telegramSettingsSchema),
    defaultValues: defaultSettings
  });

  const settingsQuery = useQuery({
    queryKey: ["telegram-settings"],
    queryFn: readTelegramSettings,
    staleTime: 120_000
  });

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset({
        bot_token: settingsQuery.data.bot_token,
        chat_id: settingsQuery.data.chat_id,
        enabled: settingsQuery.data.enabled,
        reminder_24h: settingsQuery.data.reminder_24h,
        reminder_2h: settingsQuery.data.reminder_2h
      });
    }
  }, [form, settingsQuery.data]);

  const status = useMemo(() => settingsQuery.data ?? defaultSettings, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (values: TelegramSettingsForm) => postTelegramAction({ action: "save", settings: values }),
    onSuccess: (data) => {
      if (data && typeof data === "object") {
        queryClient.setQueryData(["telegram-settings"], data);
      }
      setNotice({ type: "success", message: "Telegram подключен и настройки сохранены" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось сохранить Telegram" });
    }
  });

  const tokenMutation = useMutation({
    mutationFn: (botToken: string) => postTelegramAction({ action: "test_token", bot_token: botToken }),
    onSuccess: () => {
      setNotice({ type: "success", message: "Bot Token проверен успешно" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Telegram API вернул ошибку" });
    }
  });

  const testMessageMutation = useMutation({
    mutationFn: (values: Pick<TelegramSettingsForm, "bot_token" | "chat_id">) =>
      postTelegramAction({ action: "send_test", bot_token: values.bot_token, chat_id: values.chat_id }),
    onSuccess: (data) => {
      if (data && typeof data === "object") {
        queryClient.setQueryData(["telegram-settings"], data);
      } else {
        void queryClient.invalidateQueries({ queryKey: ["telegram-settings"] });
      }
      setNotice({ type: "success", message: "Тестовое сообщение отправлено" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось отправить тестовое сообщение" });
    }
  });

  async function checkToken() {
    const valid = await form.trigger("bot_token");
    if (!valid) {
      setNotice({ type: "error", message: "Укажите Bot Token" });
      return;
    }

    tokenMutation.mutate(form.getValues("bot_token"));
  }

  async function sendTestMessage() {
    const valid = await form.trigger(["bot_token", "chat_id"]);
    if (!valid) {
      setNotice({ type: "error", message: "Укажите Bot Token и Chat ID" });
      return;
    }

    testMessageMutation.mutate({
      bot_token: form.getValues("bot_token"),
      chat_id: form.getValues("chat_id")
    });
  }

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      {settingsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : settingsQuery.isError ? (
        <ErrorState title={settingsQuery.error instanceof Error ? settingsQuery.error.message : "Не удалось загрузить настройки Telegram"} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Подключение бота
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" noValidate onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="space-y-2">
                  <Label htmlFor="bot-token">Bot Token</Label>
                  <Input id="bot-token" autoComplete="off" placeholder="123456:telegram-token" {...form.register("bot_token")} />
                  {form.formState.errors.bot_token ? <p className="text-xs text-destructive">{form.formState.errors.bot_token.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chat-id">Chat ID</Label>
                  <Input id="chat-id" autoComplete="off" placeholder="123456789" {...form.register("chat_id")} />
                  {form.formState.errors.chat_id ? <p className="text-xs text-destructive">{form.formState.errors.chat_id.message}</p> : null}
                </div>

                <div className="grid gap-3 rounded-lg border bg-background p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className={checkboxClass()} {...form.register("enabled")} />
                    <span>
                      <span className="block font-medium">Включить уведомления</span>
                      <span className="block text-muted-foreground">BusinessHub будет отправлять клиентские и служебные уведомления через Telegram.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className={checkboxClass()} {...form.register("reminder_24h")} />
                    <span>
                      <span className="block font-medium">Напоминание за 24 часа</span>
                      <span className="block text-muted-foreground">Отправлять клиенту напоминание за день до записи.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className={checkboxClass()} {...form.register("reminder_2h")} />
                    <span>
                      <span className="block font-medium">Напоминание за 2 часа</span>
                      <span className="block text-muted-foreground">Отправлять короткое напоминание перед визитом.</span>
                    </span>
                  </label>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={checkToken} disabled={tokenMutation.isPending}>
                    <TestTube2 className="h-4 w-4" />
                    {tokenMutation.isPending ? "Проверка..." : "Проверить токен"}
                  </Button>
                  <Button type="button" variant="outline" onClick={sendTestMessage} disabled={testMessageMutation.isPending}>
                    <Send className="h-4 w-4" />
                    {testMessageMutation.isPending ? "Отправка..." : "Отправить тест"}
                  </Button>
                </div>

                <Button type="submit" disabled={saveMutation.isPending}>
                  <ShieldCheck className="h-4 w-4" />
                  {saveMutation.isPending ? "Подключение..." : "Подключить Telegram"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Статус и автоматизации</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-background p-4">
                <div className="text-sm text-muted-foreground">Статус</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  <span className={status.connected ? "text-primary" : "text-muted-foreground"}>{status.connected ? "Connected" : "Disconnected"}</span>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">Last test sent at</div>
                <div className="mt-1 text-sm">{formatDateTime(status.last_test_sent_at)}</div>
              </div>

              {[
                { label: "Уведомления", enabled: status.enabled },
                { label: "Напоминание клиенту за день", enabled: status.reminder_24h },
                { label: "Напоминание клиенту за 2 часа", enabled: status.reminder_2h }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border bg-background p-4">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className={item.enabled ? "text-primary" : "text-muted-foreground"}>
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
