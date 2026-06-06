import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { ArrowRight, CalendarCheck, LineChart, Mail, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const footerLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refund" },
  { href: "/contact", label: "Contact" }
] as const;

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const code = typeof params?.code === "string" ? params.code : null;
  if (code) {
    const callbackParams = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (typeof value === "string") {
        callbackParams.set(key, value);
      }
    });
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 noise opacity-50" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-between px-4 py-6 lg:px-6">
          <nav className="flex items-center justify-between">
            <div className="text-sm font-semibold">BusinessHub</div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link href="/login">Войти</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Начать</Link>
              </Button>
            </div>
          </nav>
          <div className="grid gap-10 py-16 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <div>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-normal md:text-7xl">BusinessHub</h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                Универсальная CRM-платформа для малого сервисного бизнеса: клиенты, записи, финансы, аналитика и
                Telegram-напоминания в одном месте.
              </p>
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
                BusinessHub помогает салонам, барбершопам, автомойкам, СТО, репетиторам, фитнес-тренерам,
                медицинским кабинетам и другим сервисным командам управлять клиентской базой, календарем записей,
                доходами, расходами, аналитикой и напоминаниями клиентам.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/register">
                    Создать аккаунт <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={"/demo" as Route}>Открыть demo</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-premium">
              <div className="grid gap-3">
                {[
                  { icon: CalendarCheck, label: "Сегодняшние записи", value: "12" },
                  { icon: Users, label: "Новые клиенты", value: "+18%" },
                  { icon: LineChart, label: "Доход за месяц", value: "$3,700" }
                ].map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-lg border bg-background p-4">
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="text-xl font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-3 pb-4 md:grid-cols-4">
            {["Салоны красоты", "Автомойки", "Репетиторство", "Медицинские кабинеты"].map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-lg border bg-card/70 p-4 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>BusinessHub · Поддержка и вопросы по оплате</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {footerLinks.map((item) => (
              <Link key={item.href} className="hover:text-foreground" href={item.href as Route}>
                {item.label}
              </Link>
            ))}
            <a className="flex items-center gap-2 hover:text-foreground" href="mailto:batyrbekovbektur0@gmail.com">
              <Mail className="h-4 w-4" />
              batyrbekovbektur0@gmail.com
            </a>
            <a className="flex items-center gap-2 hover:text-foreground" href="https://t.me/JustTriple_B">
              <Send className="h-4 w-4" />
              Telegram: @JustTriple_B
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
