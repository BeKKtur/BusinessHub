import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, description, action, onAction }: EmptyStateProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 p-8 text-center">
      <div className="mb-4 rounded-md border bg-background p-3">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? (
        <Button className="mt-5" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}
