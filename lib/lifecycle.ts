// Shared customer "pipeline" lifecycle status.
//
// This is derived LIVE from a customer's real invoices + scheduled jobs so the
// same status shows consistently on the customer profile and the mapping page.
//
// Pipeline:
//   lead            → no invoice yet
//   pending_payment → invoice sent/overdue, not paid
//   pending_install → invoice paid, work order created but no crew assigned yet
//   scheduled       → crew assigned + install/service date scheduled (not done)
//   installed       → crew marked the job completed
//   pending_removal → installed, awaiting seasonal removal
//   removed         → removed

export type LifecycleStatus =
  | "lead"
  | "pending_payment"
  | "pending_install"
  | "scheduled"
  | "installed"
  | "pending_removal"
  | "removed";

export interface LifecycleMeta {
  label: string;
  color: string;
  description: string;
}

// Colors follow the app palette: red (attention), amber (waiting on us),
// sky (in motion), green (done), blue (seasonal), gray (inactive/none).
export const LIFECYCLE_META: Record<LifecycleStatus, LifecycleMeta> = {
  lead: {
    label: "Lead",
    color: "#6b7280",
    description: "No invoice yet",
  },
  pending_payment: {
    label: "Pending Payment",
    color: "#dc2626",
    description: "Invoice sent — awaiting payment",
  },
  pending_install: {
    label: "Pending Install",
    color: "#f59e0b",
    description: "Paid — work order needs a crew assigned",
  },
  scheduled: {
    label: "Scheduled",
    color: "#0ea5e9",
    description: "Crew assigned, install/service scheduled",
  },
  installed: {
    label: "Installed",
    color: "#16a34a",
    description: "Job completed by crew",
  },
  pending_removal: {
    label: "Pending Removal",
    color: "#2563eb",
    description: "Installed — awaiting removal",
  },
  removed: {
    label: "Removed",
    color: "#6b7280",
    description: "Removed",
  },
};

// Order used when rendering status filters/legends.
export const LIFECYCLE_ORDER: LifecycleStatus[] = [
  "pending_payment",
  "pending_install",
  "scheduled",
  "installed",
  "pending_removal",
  "removed",
  "lead",
];

export interface LifecycleJobSignal {
  status: string;
  hasCrew: boolean;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_");

/**
 * Derive the current pipeline status from a customer's aggregated
 * invoice + job signals. Callers normalize their own data into these inputs.
 */
export function deriveLifecycleStatus(input: {
  hasUnpaidInvoice: boolean;
  hasPaidInvoice: boolean;
  jobs: LifecycleJobSignal[];
  installStatus?: string | null;
}): LifecycleStatus {
  const { hasUnpaidInvoice, hasPaidInvoice, jobs } = input;
  const raw = norm(input.installStatus ?? "");

  // Explicit seasonal end-states (set by crew/admin) take precedence.
  if (raw === "removed") return "removed";
  if (raw === "pending_removal") return "pending_removal";

  const anyCompleted = jobs.some((j) => norm(j.status) === "completed");
  if (anyCompleted || raw === "installed") return "installed";

  const anyScheduledWithCrew = jobs.some(
    (j) => ["scheduled", "in_progress"].includes(norm(j.status)) && j.hasCrew,
  );
  if (anyScheduledWithCrew) return "scheduled";

  // Paid but no crewed job yet → the work order still needs a crew.
  if (hasPaidInvoice) return "pending_install";
  if (hasUnpaidInvoice) return "pending_payment";

  return "lead";
}
