"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Save, Trash2, TrendingUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TD, TH, TBody, THead, TR, Table } from "@/components/ui/table";
import { Toast, type ToastNotice } from "@/components/ui/toast";

type MoneyOperation = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  occurred_at: string;
  appointment_id?: string | null;
};

type FinancePayload = {
  revenues: Array<Omit<MoneyOperation, "type">>;
  expenses: Array<Omit<MoneyOperation, "type">>;
};

const formSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Сумма должна быть больше 0"),
  category: z.string().trim().min(1, "Укажите категорию"),
  description: z.string().optional(),
  date: z.string().trim().min(1, "Укажите дату")
});

type FinanceFormValues = z.infer<typeof formSchema>;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toOperationDate(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

function toDateKey(isoDate: string) {
  return new Date(isoDate).toISOString().slice(0, 10);
}

function makeCsv(operations: MoneyOperation[]) {
  const rows = [
    ["дата", "тип операции", "категория", "описание", "сумма"],
    ...operations.map((operation) => [
      toDateKey(operation.occurred_at),
      operation.type === "income" ? "income" : "expense",
      operation.category,
      operation.description ?? "",
      String(operation.amount)
    ])
  ];

  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
}

async function fetchFinance() {
  const response = await fetch("/api/finance");
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Parameters<typeof formatApiError>[0];
    throw new Error(formatApiError(payload, "Не удалось загрузить финансы"));
  }

  const payload = (await response.json()) as { data: FinancePayload };
  return [
    ...payload.data.revenues.map((item) => ({ ...item, type: "income" as const })),
    ...payload.data.expenses.map((item) => ({ ...item, type: "expense" as const }))
  ].sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime());
}

async function saveOperation(values: FinanceFormValues, id?: string) {
  const response = await fetch("/api/finance", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(id ? { id } : {}),
      type: values.type,
      amount: values.amount,
      category: values.category,
      description: values.description?.trim() || undefined,
      occurred_at: toOperationDate(values.date)
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Parameters<typeof formatApiError>[0];
    throw new Error(formatApiError(payload, "Не удалось сохранить операцию"));
  }

  const payload = (await response.json()) as { data: MoneyOperation };
  return payload.data;
}

async function deleteOperation(operation: MoneyOperation) {
  const response = await fetch("/api/finance", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: operation.id, type: operation.type })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Parameters<typeof formatApiError>[0];
    throw new Error(formatApiError(payload, "Не удалось удалить операцию"));
  }

  return operation;
}

function buildSeries(operations: MoneyOperation[]) {
  const buckets = new Map<string, { month: string; revenue: number; profit: number }>();
  const formatter = new Intl.DateTimeFormat("ru-RU", { month: "short" });

  for (const operation of operations) {
    const date = new Date(operation.occurred_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = buckets.get(key) ?? { month: formatter.format(date), revenue: 0, profit: 0 };
    if (operation.type === "income") {
      current.revenue += Number(operation.amount);
      current.profit += Number(operation.amount);
    } else {
      current.profit -= Number(operation.amount);
    }
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

export function FinanceManager() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<MoneyOperation | undefined>();
  const [notice, setNotice] = useState<ToastNotice | undefined>();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const form = useForm<FinanceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "income",
      amount: 0,
      category: "",
      description: "",
      date: todayKey()
    }
  });

  const financeQuery = useQuery({
    queryKey: ["finance"],
    queryFn: fetchFinance,
    staleTime: 60_000
  });

  const operations = useMemo(() => financeQuery.data ?? [], [financeQuery.data]);
  const filteredOperations = useMemo(
    () =>
      operations.filter((operation) => {
        const date = toDateKey(operation.occurred_at);
        return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
      }),
    [dateFrom, dateTo, operations]
  );

  const income = filteredOperations.filter((operation) => operation.type === "income").reduce((total, operation) => total + Number(operation.amount), 0);
  const expenses = filteredOperations.filter((operation) => operation.type === "expense").reduce((total, operation) => total + Number(operation.amount), 0);
  const profit = income - expenses;
  const revenueSeries = buildSeries(filteredOperations);

  const saveMutation = useMutation({
    mutationFn: (values: FinanceFormValues) => saveOperation(values, editingOperation?.id),
    onSuccess: (savedOperation) => {
      queryClient.setQueryData<MoneyOperation[]>(["finance"], (current = []) => {
        const exists = current.some((operation) => operation.id === savedOperation.id && operation.type === savedOperation.type);
        return exists
          ? current.map((operation) => (operation.id === savedOperation.id && operation.type === savedOperation.type ? savedOperation : operation))
          : [savedOperation, ...current];
      });
      setFormOpen(false);
      setEditingOperation(undefined);
      setNotice({ type: "success", message: "Операция сохранена" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось сохранить операцию" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOperation,
    onSuccess: (deletedOperation) => {
      queryClient.setQueryData<MoneyOperation[]>(["finance"], (current = []) =>
        current.filter((operation) => !(operation.id === deletedOperation.id && operation.type === deletedOperation.type))
      );
      setNotice({ type: "success", message: "Операция удалена" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось удалить операцию" });
    }
  });

  const openCreateForm = useCallback(() => {
    setEditingOperation(undefined);
    form.reset({ type: "income", amount: 0, category: "", description: "", date: todayKey() });
    setFormOpen(true);
  }, [form]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreateForm();
      router.replace("/finance");
    }
  }, [openCreateForm, router, searchParams]);

  function openEditForm(operation: MoneyOperation) {
    setEditingOperation(operation);
    form.reset({
      type: operation.type,
      amount: Number(operation.amount),
      category: operation.category,
      description: operation.description ?? "",
      date: toDateKey(operation.occurred_at)
    });
    setFormOpen(true);
  }

  function exportCsv() {
    if (!filteredOperations.length) {
      setNotice({ type: "error", message: "Нет данных для экспорта." });
      return;
    }

    const blob = new Blob([makeCsv(filteredOperations)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `businesshub-finance-${todayKey()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ type: "success", message: "CSV-отчет экспортирован" });
  }

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Финансы</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Доходы, расходы, прибыль, статистика, графики и экспорт отчетов.</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          Добавить операцию
        </Button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="date-from">С даты</Label>
          <Input id="date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-to">По дату</Label>
          <Input id="date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Сбросить
          </Button>
        </div>
      </div>

      {financeQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : financeQuery.isError ? (
        <ErrorState title={financeQuery.error instanceof Error ? financeQuery.error.message : "Не удалось загрузить финансы"} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Доходы", income],
              ["Расходы", expenses],
              ["Прибыль", profit]
            ].map(([label, value], index) => (
              <Card key={`${label}-${index}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{formatCurrency(Number(value))}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Финансовая динамика</CardTitle>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                Экспорт
              </Button>
            </CardHeader>
            <CardContent>
              {revenueSeries.length ? (
                <RevenueChart data={revenueSeries} />
              ) : (
                <EmptyState icon={TrendingUp} title="Доходов пока нет" description="Финансовая динамика появится после добавления доходов и расходов." />
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Операции</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredOperations.length ? (
                <Table>
                  <THead>
                    <TR>
                      <TH>Дата</TH>
                      <TH>Тип</TH>
                      <TH>Категория</TH>
                      <TH>Описание</TH>
                      <TH>Сумма</TH>
                      <TH>Действия</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {filteredOperations.map((operation) => (
                      <TR key={`${operation.type}-${operation.id}`}>
                        <TD>{toDateKey(operation.occurred_at)}</TD>
                        <TD>{operation.type === "income" ? "Доход" : "Расход"}</TD>
                        <TD>{operation.category}</TD>
                        <TD>{operation.description ?? "-"}</TD>
                        <TD>{formatCurrency(Number(operation.amount))}</TD>
                        <TD>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" aria-label="Редактировать операцию" onClick={() => openEditForm(operation)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Удалить операцию" onClick={() => deleteMutation.mutate(operation)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <EmptyState icon={TrendingUp} title="Доходов пока нет" description="Добавьте доход или расход, чтобы увидеть операции." />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
          <Card className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{editingOperation ? "Редактирование операции" : "Добавление операции"}</CardTitle>
              <Button variant="ghost" size="icon" aria-label="Закрыть" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" noValidate onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="space-y-2">
                  <Label htmlFor="operation-type">Тип</Label>
                  <select id="operation-type" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register("type")}>
                    <option value="income">Доход</option>
                    <option value="expense">Расход</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operation-amount">Сумма</Label>
                  <Input id="operation-amount" type="number" min="0" step="0.01" {...form.register("amount")} />
                  {form.formState.errors.amount ? <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operation-category">Категория</Label>
                  <Input id="operation-category" {...form.register("category")} placeholder="Оплата за услугу" />
                  {form.formState.errors.category ? <p className="text-xs text-destructive">{form.formState.errors.category.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operation-date">Дата</Label>
                  <Input id="operation-date" type="date" {...form.register("date")} />
                  {form.formState.errors.date ? <p className="text-xs text-destructive">{form.formState.errors.date.message}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="operation-description">Описание</Label>
                  <textarea id="operation-description" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register("description")} />
                </div>
                {saveMutation.isError ? (
                  <div className="md:col-span-2">
                    <ErrorState title={saveMutation.error instanceof Error ? saveMutation.error.message : "Не удалось сохранить операцию"} />
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
    </>
  );
}
