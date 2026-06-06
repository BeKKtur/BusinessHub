"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast, type ToastNotice } from "@/components/ui/toast";
import { businessTypes } from "@/lib/constants";
import { formatApiError } from "@/lib/api-client";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Введите имя"),
  businessName: z.string().trim().min(2, "Введите название бизнеса"),
  businessType: z.enum(businessTypes)
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm({ initialValues }: { initialValues: ProfileFormValues }) {
  const [notice, setNotice] = useState<ToastNotice | undefined>();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues
  });

  async function onSubmit(values: ProfileFormValues) {
    setNotice(undefined);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; data?: ProfileFormValues } | null;

    if (!response.ok) {
      setNotice({ type: "error", message: formatApiError(payload, "Не удалось сохранить профиль") });
      return;
    }

    form.reset(payload?.data ?? values);
    setNotice({ type: "success", message: "Профиль обновлен" });
  }

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      <Card>
        <CardHeader>
          <CardTitle>Редактирование</CardTitle>
          <CardDescription>Можно изменить имя и данные бизнеса. Email, роль и тариф защищены от редактирования.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" noValidate onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="profile-name">Имя</Label>
              <Input id="profile-name" {...form.register("name")} />
              {form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-name">Название бизнеса</Label>
              <Input id="business-name" {...form.register("businessName")} />
              {form.formState.errors.businessName ? (
                <p className="text-xs text-destructive">{form.formState.errors.businessName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="business-type">Тип бизнеса</Label>
              <select
                id="business-type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register("businessType")}
              >
                {businessTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {form.formState.errors.businessType ? (
                <p className="text-xs text-destructive">{form.formState.errors.businessType.message}</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Save className="h-4 w-4" />
                {form.formState.isSubmitting ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
