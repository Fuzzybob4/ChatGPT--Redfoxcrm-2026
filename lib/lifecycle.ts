// Shared customer "pipeline" lifecycle status.
//
// Derived LIVE from a customer's real invoices + scheduled jobs so the same
// stage shows consistently on the customer profile and the mapping page.
//
// Automatic pipeline:
//   lead            → no estimate or invoice yet
//   estimate_sent   → estimate sent to the customer, waiting on approval
//   estimate_approved → estimate approved, invoice not sent yet
//   pending_payment → invoice sent/overdue, nothing paid
//   pending_install → deposit (or full payment) received, not installed yet
//   scheduled       → crew assigned + install/service date scheduled
//   installed       → crew marked the install completed
//   pending_removal → installed, awaiting seasonal removal
//   removed         → removed
//
// Manual dispositions (set by a team member, override the automatic stage):
//   on_hold, not_interested, lost
//
// Manual overrides are stored in `customers.install_status`.

export type LifecycleStatus =
  | "lead"
  | "estimate_sent"
  | "estimate_approved"
  | "pending_payment"
  | "pending_install"
  | "scheduled"
  | "installed"
  | "pending_removal"
  | "removed"
  | "on_hold"
  | "not_interested"
  | "lost";

export interface LifecycleMeta {
  label: string;
  color: string;
  description: string;
}

export const LIFECYCLE_META: Record<LifecycleStatus, LifecycleMeta> = {
  lead: { label: "Lead", color: "#6b7280", description: "No estimate or invoice yet" },
  estimate_sent: {
    label: "Estimate Sent",
    color: "#8b5cf6",
    description: "Estimate sent — waiting on approval",
  },
  estimate_approved: {
    label: "Estimate Approved",
    color: "#0d9488",
    description: "Estimate approved — invoice not sent yet",
  },
  pending_payment: {
    label: "Pending Payment",
    color: "#dc2626",
    description: "Invoice sent — awaiting deposit",
  },
  pending_install: {
    label: "Pending Install",
    color: "#f59e0b",
    description: "Approved — awaiting installation",
  },
  scheduled: {
    label: "Scheduled",
    color: "#0ea5e9",
    description: "Crew assigned, install scheduled",
  },
  installed: {
    label: "Installed",
    color: "#16a34a",
    description: "Install completed by crew",
  },
  pending_removal: {
    label: "Pending Removal",
    color: "#2563eb",
    description: "Installed — awaiting seasonal removal",
  },
  removed: { label: "Removed", color: "#475569", description: "Display removed" },
  on_hold: {
    label: "On Hold",
    color: "#a16207",
    description: "Paused by the customer or team",
  },
  not_interested: {
    label: "Cancelled",
    color: "#9f1239",
    description: "Cancelled or not interested this season",
  },
  lost: { label: "Lost", color: "#7f1d1d", description: "Lost to a competitor or churned" },
};

// Order used for map filters and legends: active work first, then
// completed stages, then inactive/manual dispositions.
export const LIFECYCLE_ORDER: LifecycleStatus[] = [
  "pending_install",
  "scheduled",
  "installed",
  "pending_payment",
  "estimate_approved",
  "estimate_sent",
  "pending_removal",
  "removed",
  "lead",
  "on_hold",
  "not_interested",
  "lost",
];

export const MANUAL_DISPOSITIONS = ["on_hold", "not_interested", "lost"] as const;
export type ManualDisposition = (typeof MANUAL_DISPOSITIONS)[number];

// Values a team member may set manually. `null` returns the customer to
// fully automatic stage tracking.
export const MANUAL_STAGE_OPTIONS = [
  "pending_install",
  "installed",
  "pending_removal",
  "removed",
  ...MANUAL_DISPOSITIONS,
] as const;
export type ManualStage = (typeof MANUAL_STAGE_OPTIONS)[number];

export function isManualStage(value: unknown): value is ManualStage {
  return typeof value === "string" && (MANUAL_STAGE_OPTIONS as readonly string[]).includes(value);
}

export interface LifecycleJobSignal {
  status: string;
  hasCrew: boolean;
  /** Raw job type, e.g. "install", "service", "removal". */
  jobType?: string | null;
  /** Scheduled date (YYYY-MM-DD) used to separate one season from the next. */
  date?: string | null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function isRemovalJobType(jobType: string | null | undefined): boolean {
  const t = (jobType ?? "").toLowerCase();
  return t.includes("remov") || t.includes("takedown") || t.includes("take down") || t.includes("take_down");
}

const OPEN_JOB_STATUSES = ["scheduled", "en_route", "in_progress"];

/**
 * Derive the current pipeline stage from a customer's aggregated invoice +
 * job signals. Callers normalize their own data into these inputs.
 */
export function deriveLifecycleStatus(input: {
  hasUnpaidInvoice: boolean;
  hasPaidInvoice: boolean;
  /** True when any invoice has a partial payment (deposit) recorded. */
  hasDepositPaid?: boolean;
  /** An estimate was sent (or viewed) and is still waiting on the customer. */
  hasSentEstimate?: boolean;
  /** An estimate was approved but no invoice is out yet. */
  hasApprovedEstimate?: boolean;
  jobs: LifecycleJobSignal[];
  installStatus?: string | null;
}): LifecycleStatus {
  const { hasUnpaidInvoice, hasPaidInvoice, hasDepositPaid = false, jobs } = input;
  const raw = norm(input.installStatus ?? "");

  // Manual dispositions always win — a team member set these deliberately.
  if ((MANUAL_DISPOSITIONS as readonly string[]).includes(raw)) {
    return raw as ManualDisposition;
  }

  // Explicit seasonal end-states (set by crew/admin).
  if (raw === "removed") return "removed";
  if (raw === "pending_removal") return "pending_removal";

  const removalJobs = jobs.filter((j) => isRemovalJobType(j.jobType));
  const installJobs = jobs.filter((j) => !isRemovalJobType(j.jobType));

  // A completed removal ends the season — unless a newer install job exists,
  // which means the customer has started a new season.
  const lastRemovalDate = removalJobs
    .filter((j) => norm(j.status) === "completed")
    .map((j) => j.date ?? "")
    .sort()
    .pop();
  if (lastRemovalDate !== undefined) {
    const newSeasonStarted = installJobs.some((j) => (j.date ?? "") > lastRemovalDate);
    // A manual "pending install" on a removed customer signs them up for a new season.
    if (!newSeasonStarted && raw !== "pending_install") return "removed";
  }

  const currentInstallJobs =
    lastRemovalDate !== undefined
      ? installJobs.filter((j) => (j.date ?? "") > lastRemovalDate)
      : installJobs;

  const installCompleted =
    currentInstallJobs.some((j) => norm(j.status) === "completed") || raw === "installed";

  if (installCompleted) {
    const removalOpen = removalJobs.some(
      (j) => OPEN_JOB_STATUSES.includes(norm(j.status)) && (j.date ?? "") >= (lastRemovalDate ?? ""),
    );
    return removalOpen ? "pending_removal" : "installed";
  }

  const anyScheduledWithCrew = currentInstallJobs.some(
    (j) => OPEN_JOB_STATUSES.includes(norm(j.status)) && j.hasCrew,
  );
  if (anyScheduledWithCrew) return "scheduled";

  // A deposit or full payment means the customer is committed and waiting on us.
  // Manual "pending install" holds until a crew is scheduled or the install completes.
  if (hasPaidInvoice || hasDepositPaid || raw === "pending_install") return "pending_install";
  if (hasUnpaidInvoice) return "pending_payment";
  if (input.hasApprovedEstimate) return "estimate_approved";
  if (input.hasSentEstimate) return "estimate_sent";

  return "lead";
}

/**
 * May 1 of the current holiday season (YYYY-MM-DD). Early-bird deposits start
 * in spring, while last season's final payments and removals wrap up by April.
 * Invoices and estimates from before this date belong to past seasons and
 * don't drive this season's pipeline stage (they still count toward "past
 * customer").
 */
export function currentSeasonStart(today: Date | string = new Date(), month = 5, day = 1): string {
  const t = typeof today === "string" ? today.slice(0, 10) : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const year = Number(t.slice(0, 4));
  const start = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return t >= start(year) ? start(year) : start(year - 1);
}

/** True when a timestamp/date is in the current season (missing dates count as current). */
export function inCurrentSeason(date: string | null | undefined, seasonStart = currentSeasonStart()): boolean {
  return !date || String(date).slice(0, 10) >= seasonStart;
}

/** Turn a raw estimate row into pipeline signals. */
export function estimateSignal(estimate: { status?: string | null; sentAt?: string | null; invoiceId?: string | null }) {
  const status = norm(estimate.status ?? "");
  const approved = ["accepted", "approved"].includes(status) && !estimate.invoiceId;
  const sent = ["sent", "viewed", "pending"].includes(status) || (Boolean(estimate.sentAt) && !["accepted", "approved", "declined", "rejected", "expired", "converted"].includes(status));
  return { approved, sent };
}

/** Normalize a raw invoice row/record into the payment signals above. */
export function invoicePaymentSignal(invoice: {
  status?: string | null;
  paymentState?: string | null;
  amountPaid?: number | null;
}): { paid: boolean; deposit: boolean; unpaid: boolean } {
  const status = norm(invoice.status ?? "");
  const state = norm(invoice.paymentState ?? "");
  const amountPaid = Number(invoice.amountPaid ?? 0);

  const paid = status === "paid" || state === "paid";
  const deposit =
    !paid && (amountPaid > 0 || ["partial", "partially_paid", "deposit_paid"].includes(state) || status === "partial");
  const unpaid = !paid && !deposit && ["sent", "overdue", "viewed", "unpaid"].includes(status);

  return { paid, deposit, unpaid };
}
