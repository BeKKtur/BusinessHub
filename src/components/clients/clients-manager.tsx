"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Save, Trash2, UserPlus, Users, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Client } from "@/types/database";
import { formatApiError } from "@/lib/api-client";
import { clientSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TD, TH, TBody, THead, TR, Table } from "@/components/ui/table";
import { Toast, type ToastNotice } from "@/components/ui/toast";

type ClientFormInput = z.input<typeof clientSchema>;
type ClientFormValues = z.output<typeof clientSchema>;

async function fetchClients() {
  const response = await fetch("/api/clients?limit=100");
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Parameters<typeof formatApiError>[0];
    throw new Error(formatApiError(payload, "Failed to load clients"));
  }

  const payload = (await response.json()) as { data: Client[] };
  return payload.data;
}

async function saveClient(payload: ClientFormValues, id?: string) {
  const response = await fetch("/api/clients", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(id ? { id, ...payload } : payload)
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (errorPayload?.code === "PLAN_LIMIT_REACHED") {
      const error = new Error(errorPayload.error ?? "Достигнут лимит тарифа Free.");
      error.name = "PLAN_LIMIT_REACHED";
      throw error;
    }
    throw new Error(errorPayload?.error ?? "Failed to save client");
  }

  return ((await response.json()) as { data: Client }).data;
}

async function removeClient(id: string) {
  const response = await fetch("/api/clients", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? "Failed to delete client");
  }

  return id;
}

function formDefaults(client?: Client): ClientFormValues {
  return {
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
    telegram: client?.telegram ?? ""
  };
}

export function ClientsManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Client | undefined>();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [notice, setNotice] = useState<ToastNotice | undefined>();

  const form = useForm<ClientFormInput, unknown, ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: formDefaults()
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
    staleTime: 120_000
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const filteredClients = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter((client) =>
      [client.name, client.phone, client.email ?? ""].some((value) => value.toLowerCase().includes(query))
    );
  }, [clients, debouncedSearch]);

  const saveMutation = useMutation({
    mutationFn: (values: ClientFormValues) => saveClient(values, editingClient?.id),
    onSuccess: (savedClient) => {
      queryClient.setQueryData<Client[]>(["clients"], (current = []) => {
        const exists = current.some((client) => client.id === savedClient.id);
        return exists
          ? current.map((client) => (client.id === savedClient.id ? savedClient : client))
          : [savedClient, ...current];
      });
      setFormOpen(false);
      setEditingClient(undefined);
      form.reset(formDefaults());
      setNotice({ type: "success", message: editingClient ? "Клиент обновлен" : "Клиент создан" });
    },
    onError: (error) => {
      if (error instanceof Error && error.name === "PLAN_LIMIT_REACHED") {
        setUpgradeOpen(true);
      }
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось сохранить клиента" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: removeClient,
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Client[]>(["clients"], (current = []) => current.filter((client) => client.id !== deletedId));
      setDeleteTarget(undefined);
      setNotice({ type: "success", message: "Клиент удален" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось удалить клиента" });
    }
  });

  function openCreateForm() {
    setEditingClient(undefined);
    form.reset(formDefaults());
    setFormOpen(true);
  }

  function openEditForm(client: Client) {
    setEditingClient(client);
    form.reset(formDefaults(client));
    setFormOpen(true);
  }

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Клиенты</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Создание, редактирование, удаление, история посещений и поиск клиентов.
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          Создать клиента
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            База клиентов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Поиск по имени, телефону или email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {clientsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-2/3" />
            </div>
          ) : clientsQuery.isError ? (
            <ErrorState
              title={clientsQuery.error instanceof Error ? clientsQuery.error.message : "Не удалось загрузить клиентов"}
              actionHref="/login"
              actionLabel="Войти снова"
            />
          ) : filteredClients.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Имя</TH>
                  <TH>Телефон</TH>
                  <TH>Email</TH>
                  <TH>Telegram</TH>
                  <TH>Посещения</TH>
                  <TH>Заметки</TH>
                  <TH>Действия</TH>
                </TR>
              </THead>
              <TBody>
                {filteredClients.map((client) => (
                  <TR key={client.id}>
                    <TD className="font-medium">{client.name}</TD>
                    <TD>{client.phone}</TD>
                    <TD>{client.email ?? "-"}</TD>
                    <TD>{client.telegram ?? "-"}</TD>
                    <TD>{client.visits_count}</TD>
                    <TD>{client.notes ?? "-"}</TD>
                    <TD>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" aria-label="Редактировать клиента" onClick={() => openEditForm(client)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Удалить клиента" onClick={() => setDeleteTarget(client)}>
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
              icon={UserPlus}
              title={search ? "Клиенты не найдены" : "Клиентов пока нет"}
              description={
                search
                  ? "Измените поисковый запрос или создайте нового клиента."
                  : "Добавьте первого клиента и начните вести историю посещений."
              }
              action="Создать клиента"
              onAction={openCreateForm}
            />
          )}
        </CardContent>
      </Card>

      {formOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
          <Card className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{editingClient ? "Редактирование клиента" : "Создание клиента"}</CardTitle>
              <Button variant="ghost" size="icon" aria-label="Закрыть" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" noValidate onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="space-y-2">
                  <Label htmlFor="client-name">Имя</Label>
                  <Input id="client-name" {...form.register("name")} placeholder="Алина Морозова" />
                  {form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-phone">Телефон</Label>
                  <Input id="client-phone" {...form.register("phone")} placeholder="+996 700 123 456" />
                  {form.formState.errors.phone ? <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-email">Email</Label>
                  <Input id="client-email" type="email" {...form.register("email")} placeholder="client@example.com" />
                  {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-telegram">Telegram username или chat_id</Label>
                  <Input id="client-telegram" {...form.register("telegram")} placeholder="@client или 123456789" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="client-notes">Заметки</Label>
                  <textarea
                    id="client-notes"
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...form.register("notes")}
                    placeholder="Предпочтения, история, важные детали"
                  />
                </div>
                {saveMutation.isError ? (
                  <div className="md:col-span-2">
                    <ErrorState title={saveMutation.error instanceof Error ? saveMutation.error.message : "Не удалось сохранить клиента"} />
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
              <CardTitle>Удалить клиента?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Клиент “{deleteTarget.name}” будет удален. Если у него есть записи, Supabase ограничение может запретить удаление.
              </p>
              {deleteMutation.isError ? (
                <div className="mt-4">
                  <ErrorState title={deleteMutation.error instanceof Error ? deleteMutation.error.message : "Не удалось удалить клиента"} />
                </div>
              ) : null}
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

      {upgradeOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-premium">
            <CardHeader>
              <CardTitle>Нужен тариф Pro</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                На Free можно хранить до 50 клиентов. Перейдите на Pro или Business, чтобы продолжить рост базы.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
                  Позже
                </Button>
                <Button asChild>
                  <Link href="/billing">Upgrade</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
