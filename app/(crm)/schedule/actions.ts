"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { getBusinessSender, renderEmail } from "@/lib/email/transactional";
import { JOB_SIZES, OPEN_JOB_STATUSES, jobPoints, nextWorkDay, planAutoSchedule, type JobSize, type PlanSlot } from "@/lib/schedule";
import { loadNeedsScheduling, loadScheduleSettings } from "@/lib/schedule-server";

type Fail = { ok: false; error: string };

async function requireOrg(manager = false) {
  const org = await getCurrentOrg();
  if (!org) return null;
  if (manager && !["owner", "admin", "manager"].includes((org.role || "").toLowerCase())) return null;
  return org;
}

const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

function refresh() {
  revalidatePath("/schedule");
  revalidatePath("/jobs");
  revalidatePath("/mapping");
}

export interface MovedJob {
  jobId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  from: string;
  to: string;
  emailed: boolean;
}

const prettyDay = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

/** Email customers whose install moved (only when turned on and Resend is set up). */
async function notifyMoves(db: any, orgId: string, moves: { jobId: string; customerId: string | null; to: string; changeIds: string[] }[]) {
  const sent = new Set<string>();
  const { notifyOnMove } = await loadScheduleSettings(db, orgId);
  if (!notifyOnMove || !isEmailConfigured() || !moves.length) return sent;
  const business = await getBusinessSender(db, orgId);
  const ids = [...new Set(moves.map((m) => m.customerId).filter(Boolean))] as string[];
  const { data: customers } = await db.from("customers").select("id, first_name, email").in("id", ids);
  const byId = new Map<string, any>((customers ?? []).map((c: any) => [c.id, c]));
  for (const m of moves) {
    const c = m.customerId ? byId.get(m.customerId) : null;
    if (!c?.email) continue;
    try {
      await sendEmail({
        to: c.email,
        fromName: business.name,
        replyTo: business.email ?? undefined,
        subject: `New install date: ${prettyDay(m.to)}`,
        html: renderEmail({
          business,
          greeting: `Hi ${c.first_name || "there"},`,
          paragraphs: [
            "Weather pushed our install schedule back, so we've moved your holiday lighting install to a new day.",
            "There's nothing you need to do. If the new day doesn't work, just reply and we'll sort it out.",
          ],
          details: [["New install date", prettyDay(m.to)]],
        }),
      });
      sent.add(m.jobId);
      await db.from("schedule_changes").update({ notified_at: new Date().toISOString() }).in("id", m.changeIds);
    } catch {
      // Best effort: the "who moved" list still shows them so the team can call.
    }
  }
  return sent;
}

/**
 * Rain day: every open job on `day` and after moves to the next work day,
 * keeping the order. The day is marked off so nothing gets booked on it.
 */
export async function rainOutDay(day: string): Promise<{ ok: true; batchId: string; moved: MovedJob[] } | Fail> {
  const org = await requireOrg(true);
  if (!org) return { ok: false, error: "Only owners, admins and managers can move the schedule." };
  if (!isDay(day)) return { ok: false, error: "Pick a day." };
  const db = createAdminClient();
  const { workDays, daysOff } = await loadScheduleSettings(db, org.orgId);
  const off = new Set(daysOff.map((d) => d.day));
  off.add(day);

  const { data: jobs, error } = await db
    .from("scheduled_jobs")
    .select("id, customer_id, scheduled_date, status")
    .eq("org_id", org.orgId)
    .gte("scheduled_date", day)
    .in("status", OPEN_JOB_STATUSES)
    .order("scheduled_date", { ascending: false });
  if (error) return { ok: false, error: "Couldn't load the schedule." };

  await db.from("schedule_days_off").upsert({ org_id: org.orgId, day, reason: "rain" }, { onConflict: "org_id,day" });

  const batchId = randomUUID();
  const moves: { jobId: string; customerId: string | null; from: string; to: string; changeIds: string[] }[] = [];
  for (const j of jobs ?? []) {
    const from = j.scheduled_date as string;
    const to = nextWorkDay(from, workDays, off);
    const { error: upErr } = await db.from("scheduled_jobs").update({ scheduled_date: to, updated_at: new Date().toISOString() }).eq("id", j.id).eq("org_id", org.orgId);
    if (upErr) continue;
    const { data: ch } = await db
      .from("schedule_changes")
      .insert({ org_id: org.orgId, batch_id: batchId, job_id: j.id, customer_id: j.customer_id, from_date: from, to_date: to, reason: "rain" })
      .select("id")
      .single();
    moves.push({ jobId: j.id, customerId: j.customer_id, from, to, changeIds: ch ? [ch.id] : [] });
  }

  const emailed = await notifyMoves(db, org.orgId, moves);
  const ids = [...new Set(moves.map((m) => m.customerId).filter(Boolean))] as string[];
  const { data: customers } = ids.length
    ? await db.from("customers").select("id, full_name, first_name, last_name, phone, email").in("id", ids)
    : { data: [] as any[] };
  const byId = new Map<string, any>((customers ?? []).map((c: any) => [c.id, c]));
  refresh();
  return {
    ok: true,
    batchId,
    moved: moves
      .map((m) => {
        const c = m.customerId ? byId.get(m.customerId) : null;
        return {
          jobId: m.jobId,
          customerName: c?.full_name || [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "Customer",
          phone: c?.phone ?? null,
          email: c?.email ?? null,
          from: m.from,
          to: m.to,
          emailed: emailed.has(m.jobId),
        };
      })
      .sort((a, b) => a.from.localeCompare(b.from)),
  };
}

/** Put every job from a rain-day batch back where it was and reopen the day. */
export async function undoScheduleBatch(batchId: string): Promise<{ ok: true; restored: number } | Fail> {
  const org = await requireOrg(true);
  if (!org) return { ok: false, error: "Only owners, admins and managers can move the schedule." };
  const db = createAdminClient();
  const { data: changes } = await db
    .from("schedule_changes")
    .select("id, job_id, from_date, to_date, reason")
    .eq("org_id", org.orgId)
    .eq("batch_id", batchId)
    .is("undone_at", null);
  let restored = 0;
  for (const c of changes ?? []) {
    const { error } = await db
      .from("scheduled_jobs")
      .update({ scheduled_date: c.from_date, updated_at: new Date().toISOString() })
      .eq("id", c.job_id)
      .eq("org_id", org.orgId)
      .eq("scheduled_date", c.to_date); // skip jobs someone has moved again since
    if (!error) restored++;
  }
  if (changes?.length) {
    await db.from("schedule_changes").update({ undone_at: new Date().toISOString() }).eq("org_id", org.orgId).eq("batch_id", batchId);
    // The rained-out day is the earliest original date among rain moves.
    const rainDays = changes.filter((c: any) => c.reason === "rain").map((c: any) => c.from_date as string).sort();
    if (rainDays[0]) await db.from("schedule_days_off").delete().eq("org_id", org.orgId).eq("day", rainDays[0]);
  }
  refresh();
  return { ok: true, restored };
}

/** Clear a day off without moving anything back (e.g. it didn't rain after all). */
export async function reopenDay(day: string): Promise<{ ok: true } | Fail> {
  const org = await requireOrg(true);
  if (!org || !isDay(day)) return { ok: false, error: "Not allowed." };
  await createAdminClient().from("schedule_days_off").delete().eq("org_id", org.orgId).eq("day", day);
  refresh();
  return { ok: true };
}

/** Move one job to another day and/or crew, or change its size. */
export async function updateScheduledJob(
  jobId: string,
  patch: { date?: string; crewId?: string | null; size?: JobSize },
): Promise<{ ok: true } | Fail> {
  const org = await requireOrg();
  if (!org) return { ok: false, error: "Not signed in." };
  const db = createAdminClient();
  const { data: job } = await db.from("scheduled_jobs").select("id, customer_id, scheduled_date").eq("id", jobId).eq("org_id", org.orgId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found." };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.date !== undefined) {
    if (!isDay(patch.date)) return { ok: false, error: "Pick a valid date." };
    update.scheduled_date = patch.date;
  }
  if (patch.size !== undefined) {
    if (!(patch.size in JOB_SIZES)) return { ok: false, error: "Unknown size." };
    update.job_size = patch.size;
  }
  if (patch.crewId !== undefined) {
    if (patch.crewId) {
      const { data: crew } = await db.from("crews").select("id, name").eq("id", patch.crewId).eq("org_id", org.orgId).maybeSingle();
      if (!crew) return { ok: false, error: "Crew not found." };
      update.crew_id = crew.id;
      update.crew_name = crew.name;
    } else {
      update.crew_id = null;
      update.crew_name = null;
    }
  }
  const { error } = await db.from("scheduled_jobs").update(update).eq("id", jobId).eq("org_id", org.orgId);
  if (error) return { ok: false, error: "Couldn't save." };

  if (patch.date && patch.date !== job.scheduled_date) {
    const batchId = randomUUID();
    const { data: ch } = await db
      .from("schedule_changes")
      .insert({ org_id: org.orgId, batch_id: batchId, job_id: jobId, customer_id: job.customer_id, from_date: job.scheduled_date, to_date: patch.date, reason: "reschedule" })
      .select("id")
      .single();
    await notifyMoves(db, org.orgId, [{ jobId, customerId: job.customer_id, to: patch.date, changeIds: ch ? [ch.id] : [] }]);
  }
  refresh();
  return { ok: true };
}

/** Preview: who would land on which day and crew. Nothing is saved. */
export async function previewAutoSchedule(startDate: string): Promise<{ ok: true; plan: PlanSlot[]; unplaced: number } | Fail> {
  const org = await requireOrg(true);
  if (!org) return { ok: false, error: "Only owners, admins and managers can schedule crews." };
  if (!isDay(startDate)) return { ok: false, error: "Pick a start date." };
  const db = createAdminClient();
  const [{ workDays, daysOff, crews, sizePoints }, customers] = await Promise.all([
    loadScheduleSettings(db, org.orgId),
    loadNeedsScheduling(db, org.orgId),
  ]);
  const active = crews.filter((c: { active: boolean }) => c.active);
  if (!active.length) return { ok: false, error: "Add a crew first." };

  const { data: existing } = await db
    .from("scheduled_jobs")
    .select("scheduled_date, crew_id, job_size")
    .eq("org_id", org.orgId)
    .gte("scheduled_date", startDate)
    .in("status", OPEN_JOB_STATUSES)
    .not("crew_id", "is", null);
  const booked = new Map<string, number>();
  for (const j of existing ?? []) {
    const k = `${j.scheduled_date}|${j.crew_id}`;
    booked.set(k, (booked.get(k) ?? 0) + jobPoints(j.job_size, sizePoints));
  }

  const plan = planAutoSchedule({
    customers,
    crews: active,
    startDate,
    workDays,
    daysOff: new Set(daysOff.map((d) => d.day)),
    booked,
  });
  return { ok: true, plan, unplaced: customers.length - plan.length };
}

/** Save an approved preview as scheduled install jobs. */
export async function applyAutoSchedule(plan: PlanSlot[]): Promise<{ ok: true; created: number } | Fail> {
  const org = await requireOrg(true);
  if (!org) return { ok: false, error: "Only owners, admins and managers can schedule crews." };
  if (!Array.isArray(plan) || !plan.length) return { ok: false, error: "Nothing to schedule." };
  const db = createAdminClient();

  // Re-check against the live list so nobody gets double-booked.
  const needs = new Map((await loadNeedsScheduling(db, org.orgId)).map((c) => [c.id, c] as const));
  const { crews, daySlots } = await loadScheduleSettings(db, org.orgId);
  const crewById = new Map(crews.map((c) => [c.id, c] as const));
  const ids = plan.map((p) => p.customerId).filter((id: string) => needs.has(id));
  if (!ids.length) return { ok: false, error: "Those customers are already scheduled." };

  const { data: customers } = await db
    .from("customers")
    .select("id, full_name, first_name, last_name, address, city, state, zip_code, location_id")
    .eq("org_id", org.orgId)
    .in("id", ids);
  const byId = new Map<string, any>((customers ?? []).map((c: any) => [c.id, c]));
  const year = new Date().getFullYear();

  // Stops in a crew's day get the business's time windows, in order.
  const slotIndex = new Map<string, number>();
  const SLOTS = daySlots;
  const rows = plan
    .filter((p) => byId.has(p.customerId) && crewById.has(p.crewId) && isDay(p.date))
    .map((p) => {
      const key = `${p.date}|${p.crewId}`;
      const i = slotIndex.get(key) ?? 0;
      slotIndex.set(key, i + 1);
      const [start_time, end_time] = SLOTS[Math.min(i, SLOTS.length - 1)];
      const c = byId.get(p.customerId);
      const crew = crewById.get(p.crewId)!;
      return {
        org_id: org.orgId,
        customer_id: c.id,
        title: "Holiday lighting installation",
        job_type: "install",
        scheduled_date: p.date,
        start_time,
        end_time,
        address: c.address,
        city: c.city,
        state: c.state,
        zip_code: c.zip_code,
        location_id: c.location_id ?? null,
        status: "scheduled",
        status_key: "scheduled",
        priority: "normal",
        crew_id: crew.id,
        crew_name: crew.name,
        job_size: "standard",
        season_year: year,
      };
    });
  const { error } = await db.from("scheduled_jobs").insert(rows);
  if (error) return { ok: false, error: "Couldn't create the jobs." };
  refresh();
  return { ok: true, created: rows.length };
}

export async function saveCrew(input: { id?: string; name: string; color: string; capacity: number; active: boolean }): Promise<{ ok: true } | Fail> {
  const org = await requireOrg(true);
  if (!org) return { ok: false, error: "Only owners, admins and managers can edit crews." };
  const name = (input.name || "").trim().slice(0, 40);
  if (!name) return { ok: false, error: "Give the crew a name." };
  const row = {
    org_id: org.orgId,
    name,
    color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#2563eb",
    daily_capacity: Math.min(20, Math.max(0.5, Number(input.capacity) || 3)),
    active: Boolean(input.active),
  };
  const db = createAdminClient();
  const { error } = input.id
    ? await db.from("crews").update(row).eq("id", input.id).eq("org_id", org.orgId)
    : await db.from("crews").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "There's already a crew with that name." : "Couldn't save the crew." };
  if (input.id) {
    await db.from("scheduled_jobs").update({ crew_name: name }).eq("crew_id", input.id).eq("org_id", org.orgId);
    await db.from("employees").update({ crew_name: name }).eq("crew_id", input.id).eq("org_id", org.orgId);
    revalidatePath("/crew");
  }
  refresh();
  return { ok: true };
}

export async function saveScheduleSettings(input: { workDays: number[]; notifyOnMove: boolean }): Promise<{ ok: true } | Fail> {
  const org = await requireOrg(true);
  if (!org) return { ok: false, error: "Only owners, admins and managers can change this." };
  const workDays = [...new Set((input.workDays ?? []).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
  if (!workDays.length) return { ok: false, error: "Pick at least one work day." };
  const { error } = await createAdminClient()
    .from("schedule_settings")
    .upsert({ org_id: org.orgId, work_days: workDays, notify_customers_on_move: Boolean(input.notifyOnMove), updated_at: new Date().toISOString() }, { onConflict: "org_id" });
  if (error) return { ok: false, error: "Couldn't save." };
  refresh();
  return { ok: true };
}

/** The org's crews, for every crew picker in the app. */
export async function listCrews(): Promise<{ id: string; name: string; color: string; active: boolean }[]> {
  const org = await requireOrg();
  if (!org) return [];
  const { data } = await createAdminClient()
    .from("crews")
    .select("id, name, color, active")
    .eq("org_id", org.orgId)
    .order("sort_order")
    .order("name");
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name, color: c.color, active: Boolean(c.active) }));
}

/** "+ Add a crew" from any crew picker. Returns the existing crew if the name is already taken. */
export async function quickAddCrew(
  name: string,
): Promise<{ ok: true; crew: { id: string; name: string; color: string; active: boolean } } | Fail> {
  const org = await requireOrg(true);
  if (!org) return { ok: false, error: "Only owners, admins and managers can add crews." };
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { ok: false, error: "Give the crew a name." };
  const db = createAdminClient();
  const { data: existing } = await db.from("crews").select("id, name, color, active").eq("org_id", org.orgId);
  const match = (existing ?? []).find((c: any) => c.name.trim().toLowerCase() === clean.toLowerCase());
  if (match) return { ok: true, crew: { id: match.id, name: match.name, color: match.color, active: Boolean(match.active) } };
  const palette = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];
  const { data, error } = await db
    .from("crews")
    .insert({ org_id: org.orgId, name: clean, color: palette[(existing ?? []).length % palette.length] })
    .select("id, name, color, active")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't add the crew." };
  refresh();
  revalidatePath("/crew");
  return { ok: true, crew: { id: data.id, name: data.name, color: data.color, active: Boolean(data.active) } };
}
