import "server-only";
import { invoicePaymentSignal } from "@/lib/lifecycle";
import { DEFAULT_WORK_DAYS, type PlanCustomer } from "@/lib/schedule";

type Db = any;

/** Aug 1 of the current holiday season. */
export function seasonStart(today = new Date()): string {
  const y = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  return `${y}-08-01`;
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

export async function loadScheduleSettings(db: Db, orgId: string) {
  const [{ data: s }, { data: off }, { data: crews }] = await Promise.all([
    db.from("schedule_settings").select("work_days, notify_customers_on_move").eq("org_id", orgId).maybeSingle(),
    db.from("schedule_days_off").select("day, reason").eq("org_id", orgId).gte("day", seasonStart()),
    db.from("crews").select("id, name, color, daily_capacity, active, sort_order").eq("org_id", orgId).order("sort_order").order("name"),
  ]);
  return {
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
export async function loadNeedsScheduling(db: Db, orgId: string): Promise<(PlanCustomer & { phone: string | null })[]> {
  const since = seasonStart();
  const [invoices, jobs] = await Promise.all([
    readAll((a, b) =>
      db.from("invoices").select("customer_id, status, payment_state, amount_paid, created_at").eq("org_id", orgId).gte("created_at", since).range(a, b),
    ),
    readAll((a, b) =>
      db.from("scheduled_jobs").select("customer_id, job_type, status").eq("org_id", orgId).gte("scheduled_date", since).range(a, b),
    ),
  ]);

  const booked = new Map<string, string>();
  for (const inv of invoices) {
    if (!inv.customer_id) continue;
    const sig = invoicePaymentSignal({ status: inv.status, paymentState: inv.payment_state, amountPaid: Number(inv.amount_paid ?? 0) });
    if (!sig.paid && !sig.deposit) continue;
    const prev = booked.get(inv.customer_id);
    if (!prev || inv.created_at < prev) booked.set(inv.customer_id, inv.created_at);
  }
  const hasInstall = new Set(
    jobs
      .filter((j) => j.customer_id && !String(j.job_type ?? "").toLowerCase().includes("remov") && String(j.status ?? "").toLowerCase() !== "cancelled")
      .map((j) => j.customer_id as string),
  );
  const ids = [...booked.keys()].filter((id) => !hasInstall.has(id));
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
