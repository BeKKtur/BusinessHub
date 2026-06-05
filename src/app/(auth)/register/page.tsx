import Link from "next/link";
import { Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Регистрация</CardTitle>
        <CardDescription>Создайте рабочее пространство BusinessHub.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" placeholder="Азамат" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="owner@business.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full" asChild>
            <Link href="/onboarding">Продолжить</Link>
          </Button>
          <Button className="w-full" variant="outline" type="button">
            <Chrome className="h-4 w-4" />
            Google OAuth
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
