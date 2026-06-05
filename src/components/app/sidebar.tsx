"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Building2, LifeBuoy, PanelLeftClose, Zap } from "lucide-react";
import { navItems } from "@/lib/constants";
import { planDetails, type SubscriptionPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { useAppStore } from "@/store/app-store";

type SidebarProps = {
  role?: "user" | "admin" | "super_admin";
  plan?: SubscriptionPlan;
  subscriptionStatus?: string;
  nextBilledAt?: string | null;
};

function formatRenewalDate(value?: string | null) {
  if (!value) return "Нет даты продления";
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function Sidebar({ role = "user", plan = "free", subscriptionStatus = "active", nextBilledAt = null }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const visibleNavItems = navItems.filter((item) => item.href !== "/admin" || role === "super_admin");
  const currentPlan = planDetails[plan];

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden",
          sidebarOpen ? "block" : "hidden"
        )}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">BusinessHub</div>
              <div className="text-xs text-muted-foreground">Universal CRM</div>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNavItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <div className="rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{currentPlan.label} plan</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {subscriptionStatus} · {currentPlan.clients} · {currentPlan.appointments}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{formatRenewalDate(nextBilledAt)}</div>
              </div>
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <Button asChild className="mt-3 w-full" size="sm" variant="outline">
              <Link href="/billing">{plan === "free" ? "Upgrade" : "Manage"}</Link>
            </Button>
            <Button asChild className="mt-2 w-full" size="sm" variant="ghost">
              <Link href={"/contact" as Route}>
                <LifeBuoy className="h-4 w-4" />
                Связаться с поддержкой
              </Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
