"use client";

import { Bell, Menu, Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAppStore } from "@/store/app-store";

export function Topbar() {
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const pathname = usePathname();

  function handleNewAppointment() {
    if (pathname === "/appointments") {
      window.dispatchEvent(new Event("businesshub:new-appointment"));
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Открыть меню">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="relative hidden flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="max-w-md pl-9" placeholder="Поиск клиентов, записей, услуг" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleNewAppointment}>
          <Plus className="h-4 w-4" />
          Новая запись
        </Button>
        <Button variant="outline" size="icon" aria-label="Уведомления">
          <Bell className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
