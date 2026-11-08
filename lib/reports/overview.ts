/**
 * Business-overview numbers for the Reports page, computed from rows the page
 * already loads (RLS keeps them to the signed-in org).
 *
 * Holiday-lighting seasons span the new year, so a season runs Aug 1 - Jul 31
 * and is named for the year it starts (a January 2027 payment counts toward
 * the 2026 season). An invoice's own season_year wins when it is set.
 */

type Row = Record<string, any>;

export interface ReportsOverview {
  season: number;
  collectedThisSeason: number;
  invoicedThisSeason: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  estimateCloseRate: number | null;
  estimatesDecided: number;
  averageEstimate: number | null;
  openEstimateValue: number;
  installsDone: number;
  installsScheduled: number;
  removalsOpen: number;
  newCustomersThisSeason: number;
  bySeason: Array<{ season: string; collected: number }>;
  byMonth: Array<{ month: string; collected: number }>;
  topOutstanding: Array<{ id: string; customer: string; number: string; balance: number; dueDate: string | null; overdue: boolean }>;
  topCustomers: Array<{ name: string; paid: number }>;
}

export function seasonOf(date: Date): number {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const paidOf = (i: Row) => (i.amount_paid != null ? num(i.amount_paid) : num(i.amount_paid_cents) / 100);
const totalOf = (i: Row) => (i.total_amount != null ? num(i.total_amount) : num(i.total_cents) / 100);
const lower = (v: unknown) => String(v ?? "").toLowerCase();

export function buildReportsOverview({
  invoices,
  estimates,
  customers,
  jobs,
  now = new Date(),
}: {
  invoices: Row[];
  estimates: Row[];
  customers: Row[];
  jobs: Row[];
  now?: Date;
}): ReportsOverview {
  const season = seasonOf(now);
  const live = invoices.filter((i) => !["draft", "cancelled"].includes(lower(i.status)) && !i.archived);

  const invoiceSeason = (i: Row) =>
    i.season_year ? Number(i.season_year) : seasonOf(new Date(i.created_at ?? now));
  const paidDate = (i: Row) => new Date(i.paid_at ?? i.paid_date ?? i.updated_at ?? i.created_at ?? now);

  let collectedThisSeason = 0;
  let invoicedThisSeason = 0;
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  const seasonTotals = new Map<number, number>();
  const monthTotals = new Map<string, number>();
  const paidByCustomer = new Map<string, number>();
  const today = now.toISOString().slice(0, 10);

  for (const i of live) {
    const paid = paidOf(i);
    const total = totalOf(i);
    const s = invoiceSeason(i);
    if (s === season) invoicedThisSeason += total;
    if (paid > 0) {
      const d = paidDate(i);
      const ps = i.season_year ? Number(i.season_year) : seasonOf(d);
      seasonTotals.set(ps, (seasonTotals.get(ps) ?? 0) + paid);
      if (ps === season) collectedThisSeason += paid;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + paid);
      const name = i.customer?.full_name || "Unknown";
      paidByCustomer.set(name, (paidByCustomer.get(name) ?? 0) + paid);
    }
    const balance = Math.max(total - paid, 0);
    if (balance > 0.005 && lower(i.status) !== "paid") {
      outstanding += balance;
      if (i.due_date && i.due_date < today) {
        overdue += balance;
        overdueCount += 1;
      }
    }
  }

  // Last 5 seasons, oldest first, including empty ones so gaps show.
  const bySeason = Array.from({ length: 5 }, (_, k) => season - 4 + k).map((s) => ({
    season: `${s}–${String((s + 1) % 100).padStart(2, "0")}`,
    collected: Math.round(seasonTotals.get(s) ?? 0),
  }));

  // Last 12 months, oldest first.
  const byMonth = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + k, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      collected: Math.round(monthTotals.get(key) ?? 0),
    };
  });

  const topOutstanding = live
    .map((i) => ({
      id: String(i.id),
      customer: i.customer?.full_name || "Unknown",
      number: i.invoice_number ?? "",
      balance: Math.max(totalOf(i) - paidOf(i), 0),
      dueDate: i.due_date ?? null,
      overdue: Boolean(i.due_date && i.due_date < today),
    }))
    .filter((r) => r.balance > 0.005)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.balance - a.balance)
    .slice(0, 8);

  const topCustomers = Array.from(paidByCustomer, ([name, paid]) => ({ name, paid }))
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 8);

  // Estimates: close rate counts only estimates the customer has decided on.
  const won = estimates.filter((e) => ["accepted", "converted", "approved"].includes(lower(e.status)));
  const lost = estimates.filter((e) => ["rejected", "declined", "lost"].includes(lower(e.status)));
  const decided = won.length + lost.length;
  const open = estimates.filter((e) => ["sent", "viewed", "pending"].includes(lower(e.status)));
  const estimateTotals = estimates.map((e) => num(e.total_amount)).filter((v) => v > 0);

  const jobSeason = (j: Row) =>
    j.season_year ? Number(j.season_year) : seasonOf(new Date(j.scheduled_date ?? j.created_at ?? now));
  const seasonJobs = jobs.filter((j) => jobSeason(j) === season);
  const isRemoval = (j: Row) => lower(j.job_type).includes("remov");
  const installs = seasonJobs.filter((j) => !isRemoval(j));

  return {
    season,
    collectedThisSeason,
    invoicedThisSeason,
    outstanding,
    overdue,
    overdueCount,
    estimateCloseRate: decided > 0 ? won.length / decided : null,
    estimatesDecided: decided,
    averageEstimate: estimateTotals.length
      ? estimateTotals.reduce((a, b) => a + b, 0) / estimateTotals.length
      : null,
    openEstimateValue: open.reduce((a, e) => a + num(e.total_amount), 0),
    installsDone: installs.filter((j) => lower(j.status) === "completed").length,
    installsScheduled: installs.filter((j) => lower(j.status) !== "completed" && lower(j.status) !== "cancelled").length,
    removalsOpen: seasonJobs.filter((j) => isRemoval(j) && lower(j.status) !== "completed" && lower(j.status) !== "cancelled").length,
    newCustomersThisSeason: customers.filter((c) => c.created_at && seasonOf(new Date(c.created_at)) === season && !lower((c.tags ?? []).join(",")).includes("hubspot-import")).length,
    bySeason,
    byMonth,
    topOutstanding,
    topCustomers,
  };
}
