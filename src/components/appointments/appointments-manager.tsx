"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarDays, CheckCircle2, Clock, Pencil, Plus, Save, UserX, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Appointment, AppointmentStatus, Client, Service } from "@/types/database";
import { formatApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast, type ToastNotice } from "@/components/ui/toast";

type FormStatus = AppointmentStatus;
type AppointmentAction = "complete" | "cancel" | "no_show";

type AppointmentFormState = {
  client_id: string;
  service_id: string;
  date: string;
  time: string;
  status: FormStatus;
  notes?: string;
};

const appointmentFormSchema = z.object({
  client_id: z.string().trim().min(1, "Выберите клиента."),
  service_id: z.string().trim().min(1, "Выберите активную услугу."),
  date: z.string().trim().min(1, "Выберите дату."),
  time: z.string().trim().min(1, "Выберите время."),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]),
  notes: z.string().optional()
});

type AppointmentPayload = {
  client_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: FormStatus;
  notes?: string;
};

const statuses: FormStatus[] = ["scheduled", "completed", "cancelled", "no_show"];
const statusLabels: Record<FormStatus, string> = {
  scheduled: "Запланировано",
  completed: "Завершено",
  cancelled: "Отменено",
  no_show: "Не пришёл"
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function appointmentDateKey(appointment: Appointment) {
  return toDateKey(new Date(appointment.starts_at));
}

function timeValue(appointment: Appointment) {
  const date = new Date(appointment.starts_at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildMonthDays(selectedDate: string) {
  const date = new Date(`${selectedDate}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));
}

function monthRange(selectedDate: string) {
  const date = new Date(`${selectedDate}T12:00:00`);
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { key: `${date.getFullYear()}-${date.getMonth()}`, from: from.toISOString(), to: to.toISOString() };
}

function initialForm(selectedDate: string, appointment?: Appointment): AppointmentFormState {
  if (appointment) {
    return {
      client_id: appointment.client_id,
      service_id: appointment.service_id,
      date: appointmentDateKey(appointment),
      time: timeValue(appointment),
      status: appointment.status,
      notes: appointment.notes ?? ""
    };
  }

  return {
    client_id: "",
    service_id: "",
    date: selectedDate,
    time: "09:00",
    status: "scheduled",
    notes: ""
  };
}

async function fetchAppointments(from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/appointments?${params.toString()}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Parameters<typeof formatApiError>[0];
    throw new Error(formatApiError(payload, "Failed to load appointments"));
  }

  const payload = (await response.json()) as { data: Appointment[] };
  return payload.data;
}

async function fetchClients() {
  const response = await fetch("/api/clients");
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Parameters<typeof formatApiError>[0];
    throw new Error(formatApiError(payload, "Failed to load clients"));
  }

  const payload = (await response.json()) as { data: Client[] };
  return payload.data;
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

async function saveAppointment(payload: AppointmentPayload, id?: string) {
  const response = await fetch("/api/appointments", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(id ? { id, ...payload } : payload)
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (payloadError?.code === "PLAN_LIMIT_REACHED") {
      const error = new Error(payloadError.error ?? "Достигнут лимит тарифа Free.");
      error.name = "PLAN_LIMIT_REACHED";
      throw error;
    }
    throw new Error(payloadError?.error ?? "Failed to save appointment");
  }

  return ((await response.json()) as { data: Appointment }).data;
}

async function deleteAppointment(id: string) {
  const response = await fetch("/api/appointments", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payloadError?.error ?? "Failed to delete appointment");
  }

  return id;
}

async function updateAppointmentAction(id: string, action: AppointmentAction) {
  const response = await fetch("/api/appointments", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action })
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payloadError?.error ?? "Failed to update appointment status");
  }

  return ((await response.json()) as { data: Appointment }).data;
}

function buildPayload(form: AppointmentFormState, services: Service[]): AppointmentPayload {
  const service = services.find((item) => item.id === form.service_id);
  const startsAt = new Date(`${form.date}T${form.time}:00`);
  const endsAt = new Date(startsAt.getTime() + (service?.duration_minutes ?? 60) * 60_000);

  return {
    client_id: form.client_id,
    service_id: form.service_id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: form.status,
    notes: form.notes?.trim() || undefined
  };
}

export function AppointmentsManager() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>();
  const form = useForm<z.input<typeof appointmentFormSchema>, unknown, z.output<typeof appointmentFormSchema>>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      client_id: "",
      service_id: "",
      date: toDateKey(new Date()),
      time: "09:00",
      status: "scheduled",
      notes: ""
    }
  });
  const [deleteTarget, setDeleteTarget] = useState<Appointment | undefined>();
  const [notice, setNotice] = useState<ToastNotice | undefined>();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const [actionTargetId, setActionTargetId] = useState<string | undefined>();
  const selectedMonth = useMemo(() => monthRange(selectedDate), [selectedDate]);

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", selectedMonth.key],
    queryFn: () => fetchAppointments(selectedMonth.from, selectedMonth.to),
    staleTime: 60_000
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
    staleTime: 120_000
  });

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    staleTime: 120_000
  });

  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const activeServices = useMemo(() => services.filter((service) => service.active), [services]);
  const formValues = form.watch();

  const saveMutation = useMutation({
    mutationFn: async (values: AppointmentFormState) => saveAppointment(buildPayload(values, services), editingAppointment?.id),
    onSuccess: (savedAppointment) => {
      queryClient.setQueryData<Appointment[]>(["appointments", selectedMonth.key], (current = []) => {
        const exists = current.some((item) => item.id === savedAppointment.id);
        return exists
          ? current.map((item) => (item.id === savedAppointment.id ? savedAppointment : item))
          : [...current, savedAppointment];
      });
      setSelectedDate(appointmentDateKey(savedAppointment));
      setFormOpen(false);
      setEditingAppointment(undefined);
      setFormError(undefined);
      setNotice({ type: "success", message: editingAppointment ? "Запись обновлена" : "Запись создана" });
    },
    onError: (error) => {
      if (error instanceof Error && error.name === "PLAN_LIMIT_REACHED") {
        setUpgradeOpen(true);
      }
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось сохранить запись" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Appointment[]>(["appointments", selectedMonth.key], (current = []) =>
        current.filter((item) => item.id !== deletedId)
      );
      setDeleteTarget(undefined);
      setNotice({ type: "success", message: "Запись удалена" });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось удалить запись" });
    }
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: AppointmentAction }) => updateAppointmentAction(id, action),
    onSuccess: (updatedAppointment) => {
      queryClient.setQueryData<Appointment[]>(["appointments", selectedMonth.key], (current = []) =>
        current.map((item) => (item.id === updatedAppointment.id ? updatedAppointment : item))
      );
      void queryClient.invalidateQueries({ queryKey: ["appointments", selectedMonth.key] });
      const message =
        updatedAppointment.status === "completed"
          ? "Запись завершена, доход создан"
          : updatedAppointment.status === "cancelled"
            ? "Запись отменена"
            : "Отмечено: клиент не пришёл";
      setNotice({ type: "success", message });
    },
    onError: (error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Не удалось изменить статус записи" });
    },
    onSettled: () => {
      setActionTargetId(undefined);
    }
  });

  const openCreateForm = useCallback((date = selectedDate) => {
    setEditingAppointment(undefined);
    form.reset(initialForm(date));
    setFormError(undefined);
    setFormOpen(true);
  }, [form, selectedDate]);

  useEffect(() => {
    function openFromTopbar() {
      openCreateForm();
    }

    window.addEventListener("businesshub:new-appointment", openFromTopbar);
    return () => window.removeEventListener("businesshub:new-appointment", openFromTopbar);
  }, [openCreateForm]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreateForm();
      router.replace("/appointments");
    }
  }, [openCreateForm, router, searchParams]);

  function openEditForm(appointment: Appointment) {
    setEditingAppointment(appointment);
    form.reset(initialForm(selectedDate, appointment));
    setFormError(undefined);
    setFormOpen(true);
  }

  function validateAvailability(values: AppointmentFormState) {
    const hasConflict =
      values.status === "scheduled" &&
      appointments.some(
        (appointment) =>
          appointment.id !== editingAppointment?.id &&
          appointment.status === "scheduled" &&
          appointmentDateKey(appointment) === values.date &&
          timeValue(appointment) === values.time
      );

    if (hasConflict) return "Это время уже занято. Выберите другое время.";
    return undefined;
  }

  function runAppointmentAction(id: string, action: AppointmentAction) {
    setActionTargetId(id);
    actionMutation.mutate({ id, action });
  }

  const monthDays = useMemo(() => buildMonthDays(selectedDate), [selectedDate]);
  const selectedAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointmentDateKey(appointment) === selectedDate)
        .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()),
    [appointments, selectedDate]
  );

  const selectedDateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Записи</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Создание, изменение, перенос, отмена, календарь и расписание.
          </p>
        </div>
        <Button onClick={() => openCreateForm()} disabled={clientsQuery.isLoading || servicesQuery.isLoading}>
          <Plus className="h-4 w-4" />
          Создать запись
        </Button>
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card className="h-fit min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Календарь
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 text-sm font-medium capitalize">{selectedDateLabel}</div>
            <div className="grid h-[340px] grid-cols-7 content-start gap-2 overflow-hidden text-center text-sm">
              {monthDays.map((day) => {
                const dayKey = toDateKey(day);
                const isSelected = dayKey === selectedDate;
                const hasAppointments = appointments.some((appointment) => appointmentDateKey(appointment) === dayKey);

                return (
                  <button
                    key={dayKey}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-md border bg-background transition-colors hover:border-primary hover:bg-primary/10",
                      isSelected && "border-primary bg-primary text-primary-foreground hover:bg-primary"
                    )}
                    onClick={() => {
                      setSelectedDate(dayKey);
                      form.setValue("date", dayKey, { shouldValidate: true });
                    }}
                  >
                    {day.getDate()}
                    {hasAppointments ? (
                      <span
                        className={cn(
                          "absolute bottom-2 h-1.5 w-1.5 rounded-full bg-primary",
                          isSelected && "bg-primary-foreground"
                        )}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Расписание</CardTitle>
            <Badge>{selectedDateLabel}</Badge>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto">
            {appointmentsQuery.isLoading || clientsQuery.isLoading || servicesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-2/3" />
              </div>
            ) : appointmentsQuery.isError || clientsQuery.isError || servicesQuery.isError ? (
              <ErrorState
                title={
                  [appointmentsQuery.error, clientsQuery.error, servicesQuery.error].find((error) => error instanceof Error)
                    ?.message ?? "Не удалось загрузить данные расписания"
                }
                actionHref="/login"
                actionLabel="Войти снова"
              />
            ) : selectedAppointments.length ? (
              <div className="space-y-3">
                {selectedAppointments.map((appointment) => {
                  const isScheduled = appointment.status === "scheduled";
                  const isActionLoading = actionMutation.isPending && actionTargetId === appointment.id;
                  const clientName = clients.find((client) => client.id === appointment.client_id)?.name ?? "Клиент";
                  const serviceName = services.find((service) => service.id === appointment.service_id)?.name ?? "Услуга";

                  return (
                    <div key={appointment.id} className="grid min-w-0 gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                      <Badge className="w-fit shrink-0">
                        <Clock className="mr-1 h-3 w-3" />
                        {timeValue(appointment)}
                      </Badge>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" title={clientName}>
                          {clientName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground" title={serviceName}>
                          {serviceName}
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                        <Badge
                          className={cn(
                            "shrink-0",
                            appointment.status === "completed" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
                            appointment.status === "cancelled" && "border-destructive/30 bg-destructive/10 text-destructive",
                            appointment.status === "no_show" && "border-amber-500/30 bg-amber-500/10 text-amber-600"
                          )}
                        >
                          {statusLabels[appointment.status]}
                        </Badge>
                        {isScheduled ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Завершить запись"
                              disabled={isActionLoading}
                              onClick={() => runAppointmentAction(appointment.id, "complete")}
                            >
                              {isActionLoading ? <Clock className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Отменить запись"
                              disabled={isActionLoading}
                              onClick={() => runAppointmentAction(appointment.id, "cancel")}
                            >
                              {isActionLoading ? <Clock className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Отметить неявку"
                              disabled={isActionLoading}
                              onClick={() => runAppointmentAction(appointment.id, "no_show")}
                            >
                              {isActionLoading ? <Clock className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                            </Button>
                          </>
                        ) : null}
                        <Button variant="ghost" size="icon" aria-label="Редактировать запись" onClick={() => openEditForm(appointment)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Удалить запись" onClick={() => setDeleteTarget(appointment)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="На выбранный день записей нет"
                description="Создайте запись для выбранной даты или выберите другой день в календаре."
                action="Создать запись"
                onAction={() => openCreateForm(selectedDate)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
          <Card className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden shadow-premium sm:max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{editingAppointment ? "Просмотр и редактирование записи" : "Создание записи"}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setFormOpen(false)} aria-label="Закрыть">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              <form
                id="appointment-form"
                className="grid min-w-0 gap-4 md:grid-cols-2"
                noValidate
                onSubmit={form.handleSubmit((values) => {
                  const validationError = validateAvailability(values);
                  if (validationError) {
                    setFormError(validationError);
                    setNotice({ type: "error", message: validationError });
                    return;
                  }
                  setFormError(undefined);
                  saveMutation.mutate(values);
                })}
              >
                <div className="space-y-2">
                  <Label htmlFor="client">Клиент</Label>
                  <select
                    id="client"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={formValues.client_id}
                    onChange={(event) => form.setValue("client_id", event.target.value, { shouldValidate: true })}
                  >
                    <option value="" disabled>
                      Выберите клиента
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service">Услуга</Label>
                  <select
                    id="service"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={formValues.service_id}
                    onChange={(event) => form.setValue("service_id", event.target.value, { shouldValidate: true })}
                  >
                    <option value="" disabled>
                      Выберите активную услугу
                    </option>
                    {activeServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Дата</Label>
                  <Input
                    id="date"
                    type="date"
                    {...form.register("date")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Время</Label>
                  <Input
                    id="time"
                    type="time"
                    {...form.register("time")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Статус</Label>
                  <select
                    id="status"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={formValues.status}
                    onChange={(event) => form.setValue("status", event.target.value as FormStatus, { shouldValidate: true })}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Заметка</Label>
                  <textarea
                    id="notes"
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...form.register("notes")}
                    placeholder="Комментарий к записи"
                  />
                </div>
                {Object.values(form.formState.errors).length ? (
                  <div className="md:col-span-2">
                    <ErrorState title={Object.values(form.formState.errors)[0]?.message ?? "Проверьте обязательные поля"} />
                  </div>
                ) : null}
                {formError ? (
                  <div className="md:col-span-2">
                    <ErrorState title={formError} />
                  </div>
                ) : null}
                {saveMutation.isError ? (
                  <div className="md:col-span-2">
                    <ErrorState title={saveMutation.error instanceof Error ? saveMutation.error.message : "Не удалось сохранить запись"} />
                  </div>
                ) : null}
              </form>
            </CardContent>
            <div className="flex shrink-0 justify-end gap-2 border-t bg-card p-5">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Отмена
              </Button>
              <Button
                type="submit"
                form="appointment-form"
                disabled={saveMutation.isPending || !clients.length || !activeServices.length}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-premium">
            <CardHeader>
              <CardTitle>Удалить запись?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Запись будет удалена из расписания. Для Supabase это выполнит удаление строки `appointments`.
              </p>
              {deleteMutation.isError ? <div className="mt-4"><ErrorState title="Не удалось удалить запись" /></div> : null}
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
                На Free можно создать до 100 записей. Перейдите на Pro или Business, чтобы продолжить запись клиентов.
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
