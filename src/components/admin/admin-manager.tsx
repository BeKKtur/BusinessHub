"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Eye, Lock, ShieldCheck, UserRoundCheck } from "lucide-react";
import { formatApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TD, TH, TBody, THead, TR, Table } from "@/components/ui/table";
import { Toast, type ToastNotice } from "@/components/ui/toast";

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "user" | "admin" | "super_admin";
  blocked: boolean;
  created_at: string;
};

type AdminBusiness = {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  timezone: string;
  created_at: string;
};

type AdminSubscription = {
  id: string;
  business_id: string;
  plan: "free" | "pro" | "business";
  status: string;
  paddle_id: string | null;
};

type AdminActivity = {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  created_at: string;
};

type AdminRevenue = {
  total: number;
  currency: string;
};

async function readAdminResource<T>(path: string, fallback: string) {
  const response = await fetch(path);
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;

  if (!response.ok) {
    throw new Error(formatApiError(payload, fallback));
  }

  return payload?.data as T;
}

async function postAdminAction<T>(path: string, body: Record<string, unknown>, fallback: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;

  if (!response.ok) {
    throw new Error(formatApiError(payload, fallback));
  }

  return payload?.data as T;
}

export function AdminManager() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<ToastNotice | undefined>();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const adminQueryOptions = { staleTime: 60_000 };
  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => readAdminResource<AdminUser[]>("/api/admin/users", "Не удалось загрузить пользователей"), ...adminQueryOptions });
  const businessesQuery = useQuery({ queryKey: ["admin", "businesses"], queryFn: () => readAdminResource<AdminBusiness[]>("/api/admin/businesses", "Не удалось загрузить бизнесы"), ...adminQueryOptions });
  const subscriptionsQuery = useQuery({ queryKey: ["admin", "subscriptions"], queryFn: () => readAdminResource<AdminSubscription[]>("/api/admin/subscriptions", "Не удалось загрузить подписки"), ...adminQueryOptions });
  const revenueQuery = useQuery({ queryKey: ["admin", "revenue"], queryFn: () => readAdminResource<AdminRevenue>("/api/admin/revenue", "Не удалось загрузить доход платформы"), ...adminQueryOptions });
  const activityQuery = useQuery({ queryKey: ["admin", "activity"], queryFn: () => readAdminResource<AdminActivity[]>("/api/admin/activity", "Не удалось загрузить активность"), ...adminQueryOptions });

  const isLoading = usersQuery.isLoading || businessesQuery.isLoading || subscriptionsQuery.isLoading || revenueQuery.isLoading || activityQuery.isLoading;
  const error =
    usersQuery.error ?? businessesQuery.error ?? subscriptionsQuery.error ?? revenueQuery.error ?? activityQuery.error;

  const activeSubscriptions = (subscriptionsQuery.data ?? []).filter((subscription) => subscription.status === "active").length;
  const selectedBusinesses = useMemo(
    () => (selectedUserId ? (businessesQuery.data ?? []).filter((business) => business.owner_id === selectedUserId) : []),
    [businessesQuery.data, selectedUserId]
  );

  const blockMutation = useMutation({
    mutationFn: (userId: string) => postAdminAction<AdminUser>("/api/admin/block-user", { userId }, "Не удалось заблокировать пользователя"),
    onSuccess: (user) => {
      queryClient.setQueryData<AdminUser[]>(["admin", "users"], (current = []) => current.map((item) => (item.id === user.id ? user : item)));
      void queryClient.invalidateQueries({ queryKey: ["admin", "activity"] });
      setNotice({ type: "success", message: "Пользователь заблокирован" });
    },
    onError: (mutationError) => setNotice({ type: "error", message: mutationError instanceof Error ? mutationError.message : "Не удалось заблокировать пользователя" })
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => postAdminAction<AdminUser>("/api/admin/unblock-user", { userId }, "Не удалось разблокировать пользователя"),
    onSuccess: (user) => {
      queryClient.setQueryData<AdminUser[]>(["admin", "users"], (current = []) => current.map((item) => (item.id === user.id ? user : item)));
      void queryClient.invalidateQueries({ queryKey: ["admin", "activity"] });
      setNotice({ type: "success", message: "Пользователь разблокирован" });
    },
    onError: (mutationError) => setNotice({ type: "error", message: mutationError instanceof Error ? mutationError.message : "Не удалось разблокировать пользователя" })
  });

  const planMutation = useMutation({
    mutationFn: ({ userId, plan }: { userId: string; plan: AdminSubscription["plan"] }) =>
      postAdminAction<AdminSubscription>("/api/admin/change-plan", { userId, plan }, "Не удалось изменить план"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "activity"] });
      setNotice({ type: "success", message: "План пользователя изменен" });
    },
    onError: (mutationError) => setNotice({ type: "error", message: mutationError instanceof Error ? mutationError.message : "Не удалось изменить план" })
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title={error instanceof Error ? error.message : "Admin API недоступен"} />;
  }

  const users = usersQuery.data ?? [];
  const businesses = businessesQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Пользователи", users.length],
          ["Бизнесы", businesses.length],
          ["Активные подписки", activeSubscriptions],
          ["Доход платформы", formatCurrency(revenueQuery.data?.total ?? 0)]
        ].map(([label, value], index) => (
          <Card key={`${label}-${index}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Email</TH>
                  <TH>Роль</TH>
                  <TH>Статус</TH>
                  <TH>Действия</TH>
                </TR>
              </THead>
              <TBody>
                {users.map((user) => (
                  <TR key={user.id}>
                    <TD>
                      <div className="font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">{user.full_name ?? "Без имени"}</div>
                    </TD>
                    <TD>{user.role}</TD>
                    <TD>{user.blocked ? "blocked" : "active"}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="icon" aria-label={`Посмотреть бизнес пользователя ${user.email}`} onClick={() => setSelectedUserId(user.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {user.blocked ? (
                          <Button variant="ghost" size="icon" aria-label={`Разблокировать пользователя ${user.email}`} onClick={() => unblockMutation.mutate(user.id)} disabled={unblockMutation.isPending}>
                            <UserRoundCheck className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" aria-label={`Заблокировать пользователя ${user.email}`} onClick={() => blockMutation.mutate(user.id)} disabled={blockMutation.isPending || user.role === "super_admin"}>
                            <Lock className="h-4 w-4" />
                          </Button>
                        )}
                        <select
                          aria-label={`Изменить план ${user.email}`}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          defaultValue=""
                          onChange={(event) => {
                            if (event.target.value) {
                              planMutation.mutate({ userId: user.id, plan: event.target.value as AdminSubscription["plan"] });
                              event.target.value = "";
                            }
                          }}
                          disabled={planMutation.isPending}
                        >
                          <option value="">План</option>
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="business">Business</option>
                        </select>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={ShieldCheck} title="Пользователей пока нет" description="После регистрации пользователей список появится здесь." />
          )}
        </CardContent>
      </Card>

      {selectedUserId ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Бизнесы пользователя
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedBusinesses.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {selectedBusinesses.map((business) => (
                  <div key={business.id} className="rounded-lg border bg-background p-4">
                    <div className="font-medium">{business.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{business.type} · {business.timezone}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Building2} title="Бизнес не найден" description="У выбранного пользователя пока нет workspace." />
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Бизнесы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {businesses.slice(0, 8).map((business) => (
              <div key={business.id} className="rounded-lg border bg-background p-3">
                <div className="text-sm font-medium">{business.name}</div>
                <div className="text-xs text-muted-foreground">{business.type}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Подписки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscriptions.slice(0, 8).map((subscription) => (
              <div key={subscription.id} className="flex items-center justify-between rounded-lg border bg-background p-3 text-sm">
                <span>{subscription.plan}</span>
                <span className="text-muted-foreground">{subscription.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Последние действия</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activity.length ? (
            activity.map((item) => (
              <div key={item.id} className="rounded-lg border bg-background p-3 text-sm">
                <div className="font-medium">{item.action}</div>
                <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("ru-RU")}</div>
              </div>
            ))
          ) : (
            <EmptyState icon={ShieldCheck} title="Логов пока нет" description="Admin-действия будут записываться в audit log." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
