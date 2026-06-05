import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Что-то пошло не так",
  description = "Повторите действие или проверьте подключение.",
  actionHref,
  actionLabel = "Повторить"
}: {
  title?: string;
  description?: string;
  actionHref?: Route;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {actionHref ? (
            <Button className="mt-4" variant="outline" size="sm" asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button className="mt-4" variant="outline" size="sm" type="button">
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
