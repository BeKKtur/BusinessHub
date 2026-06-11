import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton action />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <PanelSkeleton rows={5} />
        <PanelSkeleton rows={4} />
      </div>
    </div>
  );
}

export function TablePageSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton action />
      <PanelSkeleton rows={8} />
    </div>
  );
}

export function CalendarPageSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton action />
      <PanelSkeleton rows={6} />
      <PanelSkeleton rows={4} />
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <PanelSkeleton rows={6} />
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={6} />
      </div>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <PanelSkeleton rows={10} />
    </div>
  );
}

function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {action ? <Skeleton className="h-10 w-36" /> : null}
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
