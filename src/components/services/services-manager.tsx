"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Scissors, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Service } from "@/types/database";
import { formatApiError } from "@/lib/api-client";
import { cn, formatCurrency } from "@/lib/utils";
import { serviceSchema } from "@/lib/validators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TD, TH, TBody, THead, TR, Table } from "@/components/ui/table";
import { Toast, type ToastNotice } from "@/components/ui/toast";

type ServiceFormInput = z.input<typeof serviceSchema>;
type ServicePayload = z.output<typeof serviceSchema>;

function initialForm(service?: Service): ServicePayload {
  return {
    name: service?.name ?? "",
    category: service?.category ?? "",
    description: service?.description ?? undefined,
    price: service?.price ?? 0,
    duration_minutes: service?.duration_minutes ?? 60,
    active: service?.active ?? true
  };
}

async function fetchServices() {
  const response = await fetch("/api/services");
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Parameters<typeof formatApiError>[0];
    throw new Error(formatApiError(payload, "Failed to load services"));
  }

  const payload = (await response.json()) as { data: Service[] };
  return payload.data;
}

async function saveService(payload: ServicePayload, id?: string) {
  const response = await fetch("/api/services", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(id ? { id, ...payload } : payload)
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? "Failed to save service");
  }

  return ((await response.json()) as { data: Service }).data;
}

async function removeService(id: string) {
  const response = await fetch("/api/services", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? "Failed to delete service");
  }

  return id;
}

export function ServicesManager() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Service | undefined>();
  const [notice, setNotice] = useState<ToastNotice | undefined>();
  const form = useForm<ServiceFormInput, unknown, ServicePayload>({
    resolver: zodResolver(serviceSchema),
    defaultValues: initialForm()
  });

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    staleTime: 120_000
  });

  const services = servicesQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async (values: ServicePayload) => saveService(values, editingService?.id),
    onSuccess: (savedService) => {
      queryClient.setQueryData<Service[]>(["services"], (current = []) => {
        const exists = current.some((service) => service.id === savedService.id);
        return exists
          ? current.map((service) => (service.id === savedService.id ? savedService : service))
          : [savedService, ...current];
      });
      setFormOpen(false);
      setEditingService(undefined);
      form.reset(initialForm());
      setNotice({ type: "success", message: editingService ? "Услуга обновлена" : "Услуга создана" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось сохранить услугу" });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async (service: Service) =>
      saveService(
        {
          name: service.name,
          category: service.category,
          description: service.description ?? undefined,
          price: service.price,
          duration_minutes: service.duration_minutes,
          active: !service.active
        },
        service.id
      ),
    onSuccess: (savedService) => {
      queryClient.setQueryData<Service[]>(["services"], (current = []) =>
        current.map((service) => (service.id === savedService.id ? savedService : service))
      );
      setNotice({ type: "success", message: savedService.active ? "Услуга активирована" : "Услуга деактивирована" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось изменить статус услуги" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: removeService,
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Service[]>(["services"], (current = []) =>
        current.filter((service) => service.id !== deletedId)
      );
      setDeleteTarget(undefined);
      setNotice({ type: "success", message: "Услуга удалена" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось удалить услугу" });
    }
  });

  function openCreateForm() {
    setEditingService(undefined);
    form.reset(initialForm());
    setFormOpen(true);
  }

  function openEditForm(service: Service) {
    setEditingService(service);
    form.reset(initialForm(service));
    setFormOpen(true);
  }

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Услуги</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Категории, цены, длительность, описание и активность услуг.
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          Создать услугу
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary" />
            Каталог услуг
          </CardTitle>
        </CardHeader>
        <CardContent>
          {servicesQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-2/3" />
            </div>
          ) : servicesQuery.isError ? (
            <ErrorState
              title={servicesQuery.error instanceof Error ? servicesQuery.error.message : "Не удалось загрузить услуги"}
              actionHref="/login"
              actionLabel="Войти снова"
            />
          ) : services.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Услуга</TH>
                  <TH>Категория</TH>
                  <TH>Цена</TH>
                  <TH>Длительность</TH>
                  <TH>Статус</TH>
                  <TH>Действия</TH>
                </TR>
              </THead>
              <TBody>
                {services.map((service) => (
                  <TR key={service.id}>
                    <TD>
                      <div className="font-medium">{service.name}</div>
                      {service.description ? (
                        <div className="mt-1 max-w-sm text-xs text-muted-foreground">{service.description}</div>
                      ) : null}
                    </TD>
                    <TD>{service.category}</TD>
                    <TD>{formatCurrency(service.price)}</TD>
                    <TD>{service.duration_minutes} мин</TD>
                    <TD>
                      <button
                        className="rounded-md"
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate(service)}
                      >
                        <Badge
                          className={cn(
                            "cursor-pointer",
                            service.active ? "border-primary/30 bg-primary/10 text-primary" : "border-muted bg-muted text-muted-foreground"
                          )}
                        >
                          {service.active ? "Активна" : "Неактивна"}
                        </Badge>
                      </button>
                    </TD>
                    <TD>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" aria-label="Редактировать услугу" onClick={() => openEditForm(service)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Удалить услугу" onClick={() => setDeleteTarget(service)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState
              icon={Scissors}
              title="Услуг пока нет"
              description="Создайте первую услугу, чтобы использовать ее в расписании и финансовой аналитике."
              action="Создать услугу"
              onAction={openCreateForm}
            />
          )}
          {toggleMutation.isError ? <div className="mt-4"><ErrorState title="Не удалось изменить статус услуги" /></div> : null}
        </CardContent>
      </Card>

      {formOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
          <Card className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{editingService ? "Редактирование услуги" : "Создание услуги"}</CardTitle>
              <Button variant="ghost" size="icon" aria-label="Закрыть" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                noValidate
                onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              >
                <div className="space-y-2">
                  <Label htmlFor="service-name">Название услуги</Label>
                  <Input
                    id="service-name"
                    {...form.register("name")}
                    placeholder="Стрижка и укладка"
                  />
                  {form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-category">Категория</Label>
                  <Input
                    id="service-category"
                    {...form.register("category")}
                    placeholder="Основные"
                  />
                  {form.formState.errors.category ? (
                    <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-price">Цена</Label>
                  <Input
                    id="service-price"
                    min="0.01"
                    step="0.01"
                    type="number"
                    {...form.register("price", { valueAsNumber: true })}
                  />
                  {form.formState.errors.price ? <p className="text-xs text-destructive">{form.formState.errors.price.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-duration">Длительность в минутах</Label>
                  <Input
                    id="service-duration"
                    min="1"
                    step="1"
                    type="number"
                    {...form.register("duration_minutes", { valueAsNumber: true })}
                  />
                  {form.formState.errors.duration_minutes ? (
                    <p className="text-xs text-destructive">{form.formState.errors.duration_minutes.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-active">Статус</Label>
                  <select
                    id="service-active"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.watch("active") ? "active" : "inactive"}
                    onChange={(event) => form.setValue("active", event.target.value === "active", { shouldValidate: true })}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="service-description">Описание</Label>
                  <textarea
                    id="service-description"
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...form.register("description")}
                    placeholder="Краткое описание услуги"
                  />
                </div>
                {saveMutation.isError ? (
                  <div className="md:col-span-2">
                    <ErrorState title={saveMutation.error instanceof Error ? saveMutation.error.message : "Не удалось сохранить услугу"} />
                  </div>
                ) : null}
                <div className="flex justify-end gap-2 md:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    <Save className="h-4 w-4" />
                    {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-premium">
            <CardHeader>
              <CardTitle>Удалить услугу?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Услуга “{deleteTarget.name}” будет удалена из каталога. Для Supabase это удалит строку `services`.
              </p>
              {deleteMutation.isError ? <div className="mt-4"><ErrorState title="Не удалось удалить услугу" /></div> : null}
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(undefined)}>
                  Оставить
                </Button>
                <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)}>
                  {deleteMutation.isPending ? "Удаление..." : "Удалить"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
