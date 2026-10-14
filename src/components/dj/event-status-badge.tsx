import type { EventStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const styles: Record<EventStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  LIVE: "bg-cyan/15 text-cyan ring-1 ring-cyan/40",
  PAUSED: "bg-neon/15 text-neon ring-1 ring-neon/40",
  ENDED: "bg-muted text-muted-foreground",
};

export function EventStatusBadge({
  status,
  className,
}: {
  status: EventStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-wide uppercase",
        styles[status],
        className,
      )}
    >
      {status === "LIVE" ? (
        <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-cyan" />
      ) : null}
      {status}
    </span>
  );
}
