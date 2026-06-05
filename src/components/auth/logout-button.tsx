"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="outline" className="mt-3 w-full justify-start" onClick={logout}>
      <LogOut className="h-4 w-4" />
      Выйти
    </Button>
  );
}
