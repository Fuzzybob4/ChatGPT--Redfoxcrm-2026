import Link from "next/link";
import { Navigation, Plus } from "lucide-react";

import type { FieldHome, LeadStage } from "@/lib/field-homes";
import { cn } from "@/lib/utils";
import { directionsUrl, formatDay, jobTypeLabel } from "./format";

/** Suggested work order type when creating one from a home in this stage. */
function defaultTypeFor(stage: LeadStage): "install" | "removal" {
  return stage === "pending_removal" ? "removal" : "install";
}

export function HomeCard({ home, compact = false }: { home: FieldHome; compact?: boolean }) {
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
              <Link
                href={`/field/jobs/${wo.id}/edit`}
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-muted px-3 text-sm"
              >
                <span className="min-w-0 truncate text-foreground">
                  {jobTypeLabel(wo.jobType)} · {formatDay(wo.scheduledDate)}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium",
                    wo.crewCount === 0 ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {wo.crewCount === 0 ? "No crew · Update" : "Update"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No open work order.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/field/work-orders/new?customer=${home.customerId}&type=${type}`}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          New work order
        </Link>
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
