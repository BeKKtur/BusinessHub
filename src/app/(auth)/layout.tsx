import Link from "next/link";
import { Building2 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r bg-card lg:block">
        <div className="absolute inset-0 noise opacity-60" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="font-semibold">BusinessHub</span>
          </Link>
          <div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-normal">
              CRM для записей, клиентов, финансов и аналитики сервисного бизнеса.
            </h1>
            <p className="mt-5 max-w-lg text-muted-foreground">
              Салоны, барбершопы, автомойки, СТО, репетиторы, фитнес-тренеры и любые сервисные команды.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {["Клиенты", "Записи", "Доходы"].map((item) => (
              <div key={item} className="rounded-lg border bg-background/70 p-4 text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <main className="flex items-center justify-center p-6">{children}</main>
    </div>
  );
}
