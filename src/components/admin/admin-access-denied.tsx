import { ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AdminAccessDenied() {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <ShieldX className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-semibold tracking-normal">У вас нет доступа к админ-панели.</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Эта зона доступна только пользователям с ролью super_admin.
        </p>
      </CardContent>
    </Card>
  );
}
