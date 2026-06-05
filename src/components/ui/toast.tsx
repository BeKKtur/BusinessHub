import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastNotice = {
  type: "success" | "error";
  message: string;
};

export function Toast({ notice, onClose }: { notice?: ToastNotice; onClose: () => void }) {
  if (!notice) return null;

  return (
    <div className="fixed right-4 top-4 z-[60] w-[calc(100vw-2rem)] max-w-sm">
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border bg-card p-4 text-sm shadow-premium",
          notice.type === "success" ? "border-primary/30" : "border-destructive/30"
        )}
      >
        {notice.type === "success" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
        )}
        <div className="flex-1">{notice.message}</div>
        <button className="text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Закрыть уведомление">
          Закрыть
        </button>
      </div>
    </div>
  );
}
