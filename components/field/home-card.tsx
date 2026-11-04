import Link from "next/link";
import { Navigation, Plus } from "lucide-react";

import type { FieldHome, HomeWorkOrder, LeadStage } from "@/lib/field-homes";
import { cn } from "@/lib/utils";
import { directionsUrl, formatDay, jobTypeLabel } from "./format";

/** Suggested work order type when creating one from a home in this stage. */
function defaultTypeFor(stage: LeadStage): "install" | "removal" {
  return stage === "pending_removal" ? "removal" : "install";
}

export function HomeCard({
  home,
  compact = false,
  canManage = true,
}: {
  home: FieldHome;
  compact?: boolean;
  /** Crew leads and the office can create work orders and open any job; crew only their own. */
  canManage?: boolean;
}) {
  const type = defaultTypeFor(home.stage);
  return (
    <div className={cn("flex flex-col gap-3 bg-card", !compact && "rounded-xl border border-border p-4")}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate font-semibold text-foreground">{home.name}</p>
        {home.address && <p className="text-sm leading-snug text-muted-foreground">{home.address}</p>}
      </div>

      {home.openWorkOrders.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {home.openWorkOrders.map((wo) => (
            <li key={wo.id}>
              <WorkOrderRow wo={wo} canOpen={canManage || wo.assignedToMe} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No open work order.</p>
      )}

      <div className={cn("grid gap-2", canManage ? "grid-cols-2" : "grid-cols-1")}>
        {canManage && (
          <Link
            href={`/field/work-orders/new?customer=${home.customerId}&type=${type}`}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
            New work order
          </Link>
        )}
        {home.address ? (
          <a
            href={directionsUrl(home.address)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-foreground"
          >
            <Navigation className="size-4" aria-hidden="true" />
            Directions
          </a>
        ) : (
          <span className="flex min-h-11 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            No address
          </span>
        )}
      </div>
    </div>
  );
}

function WorkOrderRow({ wo, canOpen }: { wo: HomeWorkOrder; canOpen: boolean }) {
  const label = (
    <span className="min-w-0 truncate text-foreground">
      {jobTypeLabel(wo.jobType)} · {formatDay(wo.scheduledDate)}
    </span>
  );

  if (!canOpen) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-muted px-3 text-sm">
        {label}
        <span className="shrink-0 text-xs text-muted-foreground">Scheduled</span>
      </div>
    );
  }

  const status = wo.assignedToMe ? "Your job · View" : wo.crewCount === 0 ? "No crew · View" : "View";
  return (
    <Link
      href={`/field/jobs/${wo.id}`}
      className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-muted px-3 text-sm"
    >
      {label}
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          wo.assignedToMe || wo.crewCount === 0 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {status}
      </span>
    </Link>
  );
}
