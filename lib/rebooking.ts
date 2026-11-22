import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadScheduleSettings } from "@/lib/schedule-server";
import { isWorkDay } from "@/lib/schedule";

type Db = ReturnType<typeof createAdminClient>;

export type ReturningKind = "past" | "customer_lights";

const CUSTOMER_LIGHTS_RE = /\bcustomer[\s-]*(owned|owns|lights?)\b|\btheir (own )?lights\b|\bown lights\b/i;

export interface RebookSettings {
  enabled: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  leadDays: number;
}

export async function loadRebookSettings(db: Db, orgId: string): Promise<RebookSettings> {
  const { data } = await db
    .from("schedule_settings")
    .select("rebook_enabled, rebook_window_start, rebook_window_end, rebook_lead_days")
    .eq("org_id", orgId)
    .maybeSingle();
  return {
    enabled: Boolean(data?.rebook_enabled),
    windowStart: (data?.rebook_window_start as string | null) ?? null,
    windowEnd: (data?.rebook_window_end as string | null) ?? null,
    leadDays: Number(data?.rebook_lead_days ?? 3),
  };
}

/**
 * Only returning customers can book themselves: we're holding their lights
 * (past install) or they own their lights. New customers need materials
 * ordered first, so they go through the office.
 */
export async function returningKind(db: Db, orgId: string, customerId: string): Promise<ReturningKind | null> {
  const [{ data: customer }, { data: jobs }, { count: invoiceCount }] = await Promise.all([
    db.from("customers").select("tags").eq("id", customerId).eq("org_id", orgId).maybeSingle(),
    db
      .from("scheduled_jobs")
      .select("title, notes, status, scheduled_date")
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .neq("status", "cancelled")
      .order("scheduled_date", { ascending: false })
      .limit(20),
    db
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .neq("status", "cancelled"),
  ]);
  const text = `${((customer?.tags as string[]) ?? []).join(" ")} ${(jobs ?? []).map((j: any) => `${j.title ?? ""} ${j.notes ?? ""}`).join(" ")}`;
  const hasHistory = (invoiceCount ?? 0) > 0 || (jobs ?? []).some((j: any) => j.status === "completed");
  if (!hasHistory) return null;
  return CUSTOMER_LIGHTS_RE.test(text) ? "customer_lights" : "past";
}

/** The customer's install already on the calendar inside the booking window, if any. */
export async function existingBooking(db: Db, orgId: string, customerId: string, s: RebookSettings) {
  if (!s.windowStart) return null;
  let q = db
    .from("scheduled_jobs")
    .select("id, scheduled_date, start_time")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .neq("job_type", "removal")
    .gte("scheduled_date", s.windowStart)
    .order("scheduled_date", { ascending: true })
    .limit(1);
  if (s.windowEnd) q = q.lte("scheduled_date", s.windowEnd);
  const { data } = await q.maybeSingle();
  return data as { id: string; scheduled_date: string; start_time: string | null } | null;
}

export interface OpenDay {
  day: string;
  morning: boolean;
  afternoon: boolean;
}

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Days a returning customer can pick: inside the booking window, at least
 * `leadDays` out, on work days, not a day off, and with room on some crew in
 * that half of the day. Each crew's daily capacity is split morning/afternoon.
 */
export async function openDays(db: Db, orgId: string, s: RebookSettings, limit = 45): Promise<OpenDay[]> {
  const settings = await loadScheduleSettings(db, orgId);
  const crews = settings.crews.filter((c) => c.active && c.capacity > 0);
  if (!crews.length || !s.windowStart) return [];
  const first = [addDays(settings.today, Math.max(1, s.leadDays)), s.windowStart].sort().at(-1)!;
  const last = s.windowEnd ?? addDays(first, 90);
  if (first > last) return [];
  const daysOff = new Set(settings.daysOff.map((d) => d.day));
  const { data: off } = await db.from("schedule_days_off").select("day").eq("org_id", orgId).gte("day", first).lte("day", last);
  for (const d of off ?? []) daysOff.add(d.day as string);

  const { data: jobs } = await db
    .from("scheduled_jobs")
    .select("scheduled_date, start_time, crew_id")
    .eq("org_id", orgId)
    .neq("status", "cancelled")
    .gte("scheduled_date", first)
    .lte("scheduled_date", last);
  const load = new Map<string, number>(); // `${day}|${crew}|am|pm`
  for (const j of jobs ?? []) {
    const half = String(j.start_time ?? "08:00") < "12:00" ? "am" : "pm";
    const key = `${j.scheduled_date}|${j.crew_id}|${half}`;
    load.set(key, (load.get(key) ?? 0) + 1);
  }
  const room = (day: string, half: "am" | "pm") =>
    crews.some((c) => (load.get(`${day}|${c.id}|${half}`) ?? 0) < Math.max(1, Math.ceil(c.capacity / 2)));

  const out: OpenDay[] = [];
  for (let day = first; day <= last && out.length < limit; day = addDays(day, 1)) {
    if (!isWorkDay(day, settings.workDays, daysOff)) continue;
    const morning = room(day, "am");
    const afternoon = room(day, "pm");
    if (morning || afternoon) out.push({ day, morning, afternoon });
  }
  return out;
}

/** Book it: the crew with the most room that half-day gets the job. */
export async function bookReturningCustomer(
  db: Db,
  orgId: string,
  customerId: string,
  day: string,
  half: "am" | "pm",
): Promise<{ ok: true; jobId: string } | { error: string }> {
  const s = await loadRebookSettings(db, orgId);
  if (!s.enabled) return { error: "Online booking is closed right now. Please call or text us." };
  const kind = await returningKind(db, orgId, customerId);
  if (!kind) return { error: "Online booking is for returning customers. Please call or text us to get on the schedule." };
  if (await existingBooking(db, orgId, customerId, s)) return { error: "You're already on the schedule." };
  const open = (await openDays(db, orgId, s, 400)).find((d) => d.day === day);
  if (!open || !(half === "am" ? open.morning : open.afternoon)) return { error: "That spot just filled up. Please pick another." };

  const settings = await loadScheduleSettings(db, orgId);
  const { data: jobs } = await db
    .from("scheduled_jobs")
    .select("crew_id, start_time")
    .eq("org_id", orgId)
    .eq("scheduled_date", day)
    .neq("status", "cancelled");
  const used = (crewId: string) =>
    (jobs ?? []).filter((j: any) => j.crew_id === crewId && (String(j.start_time ?? "08:00") < "12:00" ? "am" : "pm") === half).length;
  const crew = settings.crews
    .filter((c) => c.active && c.capacity > 0 && used(c.id) < Math.max(1, Math.ceil(c.capacity / 2)))
    .sort((a, b) => used(a.id) - used(b.id))[0];
  if (!crew) return { error: "That spot just filled up. Please pick another." };

  const { data: c } = await db
    .from("customers")
    .select("address, city, state, zip_code, location_id")
    .eq("id", customerId)
    .eq("org_id", orgId)
    .single();
  const tag = kind === "customer_lights" ? "[CUSTOMER LIGHTS]" : "[PAST - PULL TOTE]";
  const [start_time, end_time] = half === "am" ? ["08:00", "12:00"] : ["13:00", "17:00"];
  const { data: job, error } = await db
    .from("scheduled_jobs")
    .insert({
      org_id: orgId,
      customer_id: customerId,
      title: `${tag} Holiday lighting installation`,
      job_type: "install",
      scheduled_date: day,
      start_time,
      end_time,
      address: c?.address ?? null,
      city: c?.city ?? null,
      state: c?.state ?? null,
      zip_code: c?.zip_code ?? null,
      location_id: c?.location_id ?? null,
      status: "scheduled",
      status_key: "scheduled",
      priority: "normal",
      crew_id: crew.id,
      crew_name: crew.name,
      job_size: "standard",
      season_year: Number(day.slice(0, 4)) - (Number(day.slice(5, 7)) <= 6 ? 1 : 0),
      notes: `Booked online by the customer (${half === "am" ? "morning" : "afternoon"}).`,
      booked_online_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !job) return { error: "Couldn't book that. Please try again or call us." };
  return { ok: true, jobId: job.id as string };
}
