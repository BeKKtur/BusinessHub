"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronDown, DollarSign, Scissors, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  { href: "/clients", label: "Создать клиента", icon: UserPlus },
  { href: "/services", label: "Создать услугу", icon: Scissors },
  { href: "/appointments?new=1", label: "Создать запись", icon: CalendarPlus },
  { href: "/finance?new=1", label: "Добавить доход/расход", icon: DollarSign }
];

export function DashboardQuickActions() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        Быстрое действие
        <ChevronDown className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-popover p-2 shadow-premium" role="menu">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href as Route}
              prefetch
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
              role="menuitem"
              onFocus={() => router.prefetch(action.href as Route)}
              onMouseEnter={() => router.prefetch(action.href as Route)}
              onClick={() => setOpen(false)}
            >
              <action.icon className="h-4 w-4 text-primary" />
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
