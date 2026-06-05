"use client";

import Link from "next/link";
import { CalendarCheck, Edit, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { appointments, clients, services } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TD, TH, TBody, THead, TR, Table } from "@/components/ui/table";
import { Toast, type ToastNotice } from "@/components/ui/toast";

const demoNotice = "Это демо-режим. Зарегистрируйтесь, чтобы сохранять данные.";

export function DemoPage() {
  const [notice, setNotice] = useState<ToastNotice | undefined>();

  function blockMutation() {
    setNotice({ type: "error", message: demoNotice });
  }

  return (
    <main className="min-h-screen bg-background">
      <Toast notice={notice} onClose={() => setNotice(undefined)} />
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-primary">
              BusinessHub
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Demo mode</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Read-only демо CRM с локальными данными. Реальная база Supabase пользователя не используется.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/login">Войти</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Создать аккаунт</Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-4 py-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarCheck className="h-4 w-4 text-primary" />
                Записи сегодня
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{appointments.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                Клиенты
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{clients.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Доход за месяц</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{formatCurrency(3700)}</CardContent>
          </Card>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Клиенты</CardTitle>
              <Button size="sm" onClick={blockMutation}>
                <Plus className="h-4 w-4" />
                Создать клиента
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Имя</TH>
                    <TH>Телефон</TH>
                    <TH>Действия</TH>
                  </TR>
                </THead>
                <TBody>
                  {clients.map((client) => (
                    <TR key={client.id}>
                      <TD>{client.name}</TD>
                      <TD>{client.phone}</TD>
                      <TD>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" aria-label="Редактировать demo клиента" onClick={blockMutation}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Удалить demo клиента" onClick={blockMutation}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Услуги</CardTitle>
              <Button size="sm" onClick={blockMutation}>
                <Plus className="h-4 w-4" />
                Создать услугу
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
                  <div>
                    <div className="text-sm font-medium">{service.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {service.category} · {formatCurrency(service.price)}
                    </div>
                  </div>
                  <Badge>{service.active ? "active" : "inactive"}</Badge>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={blockMutation}>
                <Plus className="h-4 w-4" />
                Создать запись
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
