import "server-only";
import { invoicePaymentSignal } from "@/lib/lifecycle";
import { DEFAULT_DAY_SLOTS, DEFAULT_SIZE_POINTS, DEFAULT_WORK_DAYS, todayIn, type PlanCustomer, type SizePoints } from "@/lib/schedule";

type Db = any;

import { currentSeasonStart } from "@/lib/lifecycle";

/** Start of the current season for a business (its own season start and time zone). */
export function seasonStart(rules?: { timezone?: string; seasonStartMonth?: number; seasonStartDay?: number }): string {
  return currentSeasonStart(todayIn(rules?.timezone), rules?.seasonStartMonth ?? 5, rules?.seasonStartDay ?? 1);
}

async function readAll<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface BusinessRules {
  timezone: string;
  seasonStartMonth: number;
  seasonStartDay: number;
  /** YYYY-MM-DD the current season started, in the business's time zone. */
  seasonStart: string;
  /** Today in the business's time zone. */
  today: string;
  daySlots: [string, string][];
  sizePoints: SizePoints;
  crewHidePrices: boolean;
  /** Season label: the year the current season started in. */
  seasonYear: number;
  removalStartMonth: number;
  removalStartDay: number;
  /** First takedown day for the current season (YYYY-MM-DD). */
  removalStart: string;
  rebookAuto: boolean;
  rebookDepositPercent: number;
  /** Offer a multi-year, pay-monthly contract alongside the rebook deposit. */
  contractOffer: boolean;
  contractYears: number;
  contractPercent: number;
  contractMonths: number[];
}

const RULE_COLUMNS =
  "timezone, season_start_month, season_start_day, day_slots, job_size_points, crew_hide_prices, removal_start_month, removal_start_day, rebook_auto, rebook_deposit_percent, contract_offer, contract_years, contract_percent, contract_months";

function rulesFromRow(s: any): BusinessRules {
  const timezone = typeof s?.timezone === "string" && s.timezone ? s.timezone : "America/Chicago";
  const seasonStartMonth = Number(s?.season_start_month) || 5;
  const seasonStartDay = Number(s?.season_start_day) || 1;
  const slots = Array.isArray(s?.day_slots)
    ? (s.day_slots as unknown[]).filter((x): x is [string, string] => Array.isArray(x) && x.length === 2 && /^\d\d:\d\d$/.test(String(x[0])) && /^\d\d:\d\d$/.test(String(x[1])))
    : [];
  const pts = (s?.job_size_points ?? {}) as Partial<SizePoints>;
  const num = (v: unknown, d: number) => (typeof v === "number" && v > 0 && v <= 10 ? v : d);
  const seasonStartDate = currentSeasonStart(todayIn(timezone), seasonStartMonth, seasonStartDay);
  const seasonYear = Number(seasonStartDate.slice(0, 4));
  const removalStartMonth = Number(s?.removal_start_month) || 1;
  const removalStartDay = Number(s?.removal_start_day) || 2;
  const md = `${String(removalStartMonth).padStart(2, "0")}-${String(removalStartDay).padStart(2, "0")}`;
  const removalStart = `${seasonYear}-${md}` > seasonStartDate ? `${seasonYear}-${md}` : `${seasonYear + 1}-${md}`;
  return {
    seasonYear,
    removalStartMonth,
    removalStartDay,
    removalStart,
    rebookAuto: Boolean(s?.rebook_auto),
    rebookDepositPercent: Math.min(100, Math.max(0, Number(s?.rebook_deposit_percent ?? 50))),
    contractOffer: Boolean(s?.contract_offer),
    contractYears: Number(s?.contract_years) || 3,
    contractPercent: Number(s?.contract_percent) || 10,
    contractMonths: Array.isArray(s?.contract_months) && s.contract_months.length ? (s.contract_months as number[]) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    timezone,
    seasonStartMonth,
    seasonStartDay,
    seasonStart: seasonStartDate,
    today: todayIn(timezone),
    daySlots: slots.length ? slots : DEFAULT_DAY_SLOTS,
    sizePoints: {
      small: num(pts.small, DEFAULT_SIZE_POINTS.small),
      standard: num(pts.standard, DEFAULT_SIZE_POINTS.standard),
      large: num(pts.large, DEFAULT_SIZE_POINTS.large),
    },
    crewHidePrices: s?.crew_hide_prices !== false,
  };
}

/** The business's own rules (season, time zone, time slots, job sizes, crew privacy). */
export async function loadBusinessRules(db: Db, orgId: string): Promise<BusinessRules> {
  const { data } = await db.from("schedule_settings").select(RULE_COLUMNS).eq("org_id", orgId).maybeSingle();
  return rulesFromRow(data);
}

export interface ScheduleSettings extends BusinessRules {
  workDays: number[];
  notifyOnMove: boolean;
  daysOff: { day: string; reason: string }[];
  crews: { id: string; name: string; color: string; capacity: number; active: boolean }[];
}

export async function loadScheduleSettings(db: Db, orgId: string): Promise<ScheduleSettings> {
  const { data: s } = await db
    .from("schedule_settings")
    .select(`work_days, notify_customers_on_move, ${RULE_COLUMNS}`)
    .eq("org_id", orgId)
    .maybeSingle();
  const rules = rulesFromRow(s);
  const [{ data: off }, { data: crews }] = await Promise.all([
    db.from("schedule_days_off").select("day, reason").eq("org_id", orgId).gte("day", rules.seasonStart),
    db.from("crews").select("id, name, color, daily_capacity, active, sort_order").eq("org_id", orgId).order("sort_order").order("name"),
  ]);
  return {
    ...rules,
    workDays: (s?.work_days as number[] | undefined)?.length ? (s!.work_days as number[]) : DEFAULT_WORK_DAYS,
    notifyOnMove: Boolean(s?.notify_customers_on_move),
    daysOff: (off ?? []) as { day: string; reason: string }[],
    crews: (crews ?? []).map((c: any) => ({
      id: c.id as string,
      name: c.name as string,
      color: c.color as string,
      capacity: Number(c.daily_capacity),
      active: Boolean(c.active),
    })),
  };
}

/**
 * Customers who have paid a deposit (or in full) this season but have no
 * install on the calendar yet: the "needs scheduling" list.
 */
export async function loadNeedsScheduling(db: Db, orgId: string, since?: string): Promise<(PlanCustomer & { phone: string | null })[]> {
  if (!since) since = (await loadBusinessRules(db, orgId)).seasonStart;
  const [invoices, jobs] = await Promise.all([
    readAll((a, b) =>
      db
        .from("invoices")
        .select("customer_id, status, payment_state, amount_paid, created_at, season_year")
        .eq("org_id", orgId)
        .or(`created_at.gte.${since},season_year.eq.${Number(since.slice(0, 4))}`)
        .range(a, b),
    ),
    readAll((a, b) =>
      db.from("scheduled_jobs").select("customer_id, job_type, status").eq("org_id", orgId).gte("scheduled_date", since).range(a, b),
    ),
  ]);

  const booked = new Map<string, string>();
  const thisSeason = Number(since.slice(0, 4));
  for (const inv of invoices) {
    if (!inv.customer_id) continue;
    // Next season's rebook deposits don't need an install this season.
    if (inv.season_year != null && Number(inv.season_year) !== thisSeason) continue;
    const sig = invoicePaymentSignal({ status: inv.status, paymentState: inv.payment_state, amountPaid: Number(inv.amount_paid ?? 0) });
    if (!sig.paid && !sig.deposit) continue;
    const prev = booked.get(inv.customer_id);
    if (!prev || inv.created_at < prev) booked.set(inv.customer_id, inv.created_at);
  }
  const hasInstall = new Set(
    jobs
      .filter(
        (j: any) =>
          j.customer_id &&
          !String(j.job_type ?? "").toLowerCase().includes("remov") &&
          !["cancelled", "needs_return"].includes(String(j.status ?? "").toLowerCase()),
      )
      .map((j: any) => j.customer_id as string),
  );
  const ids = [...booked.keys()].filter((id: string) => !hasInstall.has(id));
  if (!ids.length) return [];

  const customers: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db
      .from("customers")
      .select("id, full_name, first_name, last_name, address, city, phone, lat, lng, install_status, tags")
      .eq("org_id", orgId)
      .in("id", ids.slice(i, i + 200));
    customers.push(...(data ?? []));
  }
  const skip = new Set(["on_hold", "not_interested", "lost", "removed", "installed"]);
  return customers
    .filter((c) => !skip.has(String(c.install_status ?? "").toLowerCase()) && !(c.tags ?? []).includes("vendor"))
    .map((c) => ({
      id: c.id,
      name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Customer",
      address: [c.address, c.city].filter(Boolean).join(", "),
      phone: c.phone ?? null,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      bookedAt: booked.get(c.id) ?? "",
    }))
    .sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
}

/**
 * Installed this season but no takedown on the calendar yet: the removal list.
 * First installed, first taken down.
 */
export async function loadNeedsRemoval(
  db: Db,
  orgId: string,
  since?: string,
): Promise<(PlanCustomer & { phone: string | null; size: string })[]> {
  if (!since) since = (await loadBusinessRules(db, orgId)).seasonStart;
  const jobs = await readAll((a, b) =>
    db
      .from("scheduled_jobs")
      .select("customer_id, job_type, status, scheduled_date, completed_at, job_size")
      .eq("org_id", orgId)
      .gte("scheduled_date", since)
      .is("archived_at", null)
      .range(a, b),
  );
  const installed = new Map<string, { at: string; size: string }>();
  const hasRemoval = new Set<string>();
  for (const j of jobs as any[]) {
    if (!j.customer_id) continue;
    const type = String(j.job_type ?? "").toLowerCase();
    const status = String(j.status ?? "").toLowerCase();
    if (type.includes("remov")) {
      if (status !== "cancelled") hasRemoval.add(j.customer_id);
    } else if (status === "completed") {
      const at = String(j.completed_at ?? j.scheduled_date ?? "");
      const prev = installed.get(j.customer_id);
      if (!prev || at < prev.at) installed.set(j.customer_id, { at, size: j.job_size ?? "standard" });
    }
  }
  const ids = [...installed.keys()].filter((id) => !hasRemoval.has(id));
  if (!ids.length) return [];
  const customers: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db
      .from("customers")
      .select("id, full_name, first_name, last_name, address, city, phone, lat, lng, install_status, tags")
      .eq("org_id", orgId)
      .in("id", ids.slice(i, i + 200));
    customers.push(...(data ?? []));
  }
  return customers
    .filter((c) => String(c.install_status ?? "").toLowerCase() !== "removed" && !(c.tags ?? []).includes("vendor"))
    .map((c) => ({
      id: c.id,
      name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Customer",
      address: [c.address, c.city].filter(Boolean).join(", "),
      phone: c.phone ?? null,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      bookedAt: installed.get(c.id)?.at ?? "",
      size: installed.get(c.id)?.size ?? "standard",
    }))
    .sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
}
