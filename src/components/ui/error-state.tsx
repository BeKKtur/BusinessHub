import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ title = "Что-то пошло не так" }: { title?: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Повторите действие или проверьте подключение.</p>
          <Button className="mt-4" variant="outline" size="sm">
            Повторить
          </Button>
        </div>
      </div>
    </div>
  );
}
