import Link from "next/link";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Button asChild variant="ghost">
          <Link href="/">BusinessHub</Link>
        </Button>
        <Card className="mt-8 shadow-premium">
          <CardHeader>
            <CardTitle className="text-3xl tracking-normal">Связаться с поддержкой</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Если возникли вопросы по оплате, подключению Telegram или запуску BusinessHub, напишите владельцу проекта.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <a className="flex items-center gap-3 rounded-lg border bg-background p-4 text-foreground" href="mailto:batyrbekovbektur0@gmail.com">
                <Mail className="h-4 w-4 text-primary" />
                batyrbekovbektur0@gmail.com
              </a>
              <a className="flex items-center gap-3 rounded-lg border bg-background p-4 text-foreground" href="https://t.me/JustTriple_B">
                <Send className="h-4 w-4 text-primary" />
                Telegram: @JustTriple_B
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
