"use server";

import { revalidatePath } from "next/cache";
import { checklistGaps, crewRoster, getAccessibleJob, getAssignedJobs, getFieldContext, isOpenStatus, loadJobChecklist, type ChecklistMark } from "@/lib/field";
import { createNotification } from "@/lib/notifications-server";
import { RETURN_REASONS, type ReturnReason } from "@/components/field/format";

type ActionResult = { error: string } | { ok: true; nextJobId?: string | null };

async function loadMyJob(jobId: string) {
  const { org, employee, admin, canRunJobs } = await getFieldContext();
  if (!employee) {
    return {
      ok: false as const,
      error: "Your login isn't linked to an employee profile yet. Ask the office to send you a login invite.",
    };
  }

  const access = await getAccessibleJob(org.orgId, employee.id, org.role, jobId);
  if (!access?.assigned) return { ok: false as const, error: "This job isn't assigned to you." };
  if (!canRunJobs) {
    // Once the crew lead has ended their day, whoever is left can finish the job.
    const { crewLeadStillWorking } = await import("@/lib/field");
    if (await crewLeadStillWorking(org.orgId, access.job.crewId ?? employee.crewId)) {
      return { ok: false as const, error: "Your crew lead starts, pauses and finishes jobs. You can still add photos." };
    }
  }

  return { ok: true as const, org, employee, admin, job: access.job };
}

function refreshViews(jobId: string) {
  revalidatePath("/field");
  revalidatePath(`/field/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/mapping");
}

export async function markOnMyWay(jobId: string): Promise<ActionResult> {
  const ctx = await loadMyJob(jobId);
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.job.status !== "scheduled") return { ok: true };

  const now = new Date().toISOString();
  const { error } = await ctx.admin
    .from("scheduled_jobs")
    .update({ status: "en_route", status_key: "en_route", en_route_at: now, updated_at: now })
    .eq("id", jobId)
    .eq("org_id", ctx.org.orgId);
  if (error) return { error: "Could not update the job. Please try again." };

  refreshViews(jobId);
  return { ok: true };
}

export async function startJob(jobId: string, location?: string | null): Promise<ActionResult> {
  const ctx = await loadMyJob(jobId);
  if (!ctx.ok) return { error: ctx.error };
  const { admin, org, employee, job } = ctx;

  if (job.status === "completed") return { error: "This job is already completed." };
  {
    const { loadBusinessRules } = await import("@/lib/schedule-server");
    const { today } = await loadBusinessRules(admin, org.orgId);
    if (job.scheduledDate && job.scheduledDate > today) {
      const day = new Date(`${job.scheduledDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      return { error: `This job is scheduled for ${day}. You can start it that day.` };
    }
  }

  // Load the truck first: every item checked or marked Missing (first start only).
  if (job.status === "scheduled" || job.status === "en_route") {
    const { list, marks } = await loadJobChecklist(org.orgId, job);
    const { load } = checklistGaps(list, marks);
    if (load.length) {
      return { error: `Finish "Load the truck" first: check each item or mark it Missing (${load.length} left).` };
    }
  }

  const { data: openEntries } = await admin
    .from("time_entries")
    .select("id, scheduled_job_id")
    .eq("employee_id", employee.id)
    .not("scheduled_job_id", "is", null)
    .is("clock_out", null);

  const otherOpen = (openEntries ?? []).find((e) => e.scheduled_job_id !== jobId);
  if (otherOpen) return { error: "You're still clocked in on another job. Complete it first." };

  const now = new Date().toISOString();

  // Job time goes to the lead plus crew members who have started their own day
  // (Start day). Nobody gets put on the clock just because the lead did.
  const crewId = job.crewId ?? employee.crewId;
  const crewMates = crewId ? await crewRoster(admin, org.orgId, crewId) : [];
  const { data: onDay } = crewMates.length
    ? await admin
        .from("time_entries")
        .select("employee_id")
        .in("employee_id", crewMates)
        .is("scheduled_job_id", null)
        .is("clock_out", null)
    : { data: [] as { employee_id: string }[] };
  const ids = [...new Set([employee.id, ...(onDay ?? []).map((r: { employee_id: string }) => r.employee_id)])];
  const { data: busy } = await admin
    .from("time_entries")
    .select("employee_id, scheduled_job_id")
    .in("employee_id", ids)
    .not("scheduled_job_id", "is", null)
    .is("clock_out", null);
  const busyIds = new Set((busy ?? []).map((b: { employee_id: string }) => b.employee_id));
  const rows = ids
    .filter((id) => !busyIds.has(id))
    .map((id) => ({
      org_id: org.orgId,
      employee_id: id,
      scheduled_job_id: jobId,
      clock_in: now,
      break_minutes: 0,
      location_clock_in: id === employee.id ? location?.slice(0, 120) ?? null : null,
    }));
  if (rows.length) {
    const { error: entryError } = await admin.from("time_entries").insert(rows);
    if (entryError) return { error: "Could not start the timer. Please try again." };
  }
  // Lead forgot to tap Start day? Starting a job starts it for them (only them).
  await startShift(admin, org.orgId, [employee.id], location).catch((e) => console.error("[field] auto clock-in failed", employee.id, e));

  const { error } = await admin
    .from("scheduled_jobs")
    .update({
      status: "in_progress",
      status_key: "in_progress",
      started_at: job.startedAt ?? now,
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("org_id", org.orgId);
  if (error) return { error: "Could not update the job. Please try again." };

  refreshViews(jobId);
  return { ok: true };
}

export async function completeJob(
  jobId: string,
  crewNotes?: string,
  location?: string | null,
): Promise<ActionResult> {
  const ctx = await loadMyJob(jobId);
  if (!ctx.ok) return { error: ctx.error };
  const { admin, org, employee, job } = ctx;

  if (job.status === "completed") return { ok: true, nextJobId: await findNextJob(org.orgId, employee.id, jobId) };
  if (job.status !== "in_progress") return { error: "Start the job before completing it." };

  // Proof of the finished install: at least one photo taken during this job.
  if (job.customerId) {
    const since = job.startedAt ?? new Date(Date.now() - 18 * 3_600_000).toISOString();
    const [{ count: propCount }, { count: custCount }] = await Promise.all([
      admin.from("property_photos").select("id", { count: "exact", head: true }).eq("customer_id", job.customerId).gte("created_at", since),
      admin.from("customer_photos").select("id", { count: "exact", head: true }).eq("customer_id", job.customerId).gte("created_at", since),
    ]);
    if (!(propCount ?? 0) && !(custCount ?? 0)) {
      return { error: "Take at least one photo of the finished install first (Take photo, above)." };
    }
  }

  {
    const { list, marks } = await loadJobChecklist(org.orgId, job);
    const gaps = checklistGaps(list, marks);
    if (gaps.site.length) return { error: `Answer "Confirm on site" first (${gaps.site.length} left).` };
    if (gaps.steps.length) {
      return { error: `Check off every job step, or mark it "Can't finish" with a reason (${gaps.steps.length} left).` };
    }
    const skipped = list.steps
      .map((k) => [k, marks[`step:${k}`]] as const)
      .filter(([, m]) => m?.s === "cant")
      .map(([k, m]) => `${k}: ${m?.reason}`);
    if (skipped.length) {
      crewNotes = [crewNotes, `Couldn't finish:\n- ${skipped.join("\n- ")}`].filter(Boolean).join("\n\n");
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Clock out everyone still on this job so no timer is left running.
  const { data: openEntries } = await admin
    .from("time_entries")
    .select("id, employee_id, clock_in, break_minutes")
    .eq("scheduled_job_id", jobId)
    .is("clock_out", null);

  for (const entry of openEntries ?? []) {
    const workedMs = now.getTime() - new Date(entry.clock_in).getTime();
    const hours = Math.max(0, workedMs / 3_600_000 - (entry.break_minutes ?? 0) / 60);
    await admin
      .from("time_entries")
      .update({
        clock_out: nowIso,
        total_hours: Math.round(hours * 100) / 100,
        location_clock_out: entry.employee_id === employee.id ? location?.slice(0, 120) ?? null : null,
        updated_at: nowIso,
      })
      .eq("id", entry.id);
  }

  const { data: current } = await admin
    .from("scheduled_jobs")
    .select("internal_notes")
    .eq("id", jobId)
    .single();

  const note = crewNotes?.trim().slice(0, 2000);
  const internalNotes = note
    ? [current?.internal_notes, `${employee.name} (${now.toLocaleDateString("en-US")}): ${note}`]
        .filter(Boolean)
        .join("\n")
    : current?.internal_notes ?? null;

  const { error } = await admin
    .from("scheduled_jobs")
    .update({
      status: "completed",
      status_key: "completed",
      completed_at: nowIso,
      completed_by: employee.id,
      internal_notes: internalNotes,
      updated_at: nowIso,
    })
    .eq("id", jobId)
    .eq("org_id", org.orgId);
  if (error) return { error: "Could not complete the job. Please try again." };

  refreshViews(jobId);
  revalidatePath("/customers");
  if (job.customerId) revalidatePath(`/customers/${job.customerId}`);

  return { ok: true, nextJobId: await findNextJob(org.orgId, employee.id, jobId) };
}


/** Start the work-day clock for these employees (skips anyone already on it). */
async function startShift(admin: any, orgId: string, employeeIds: string[], location?: string | null, clockInIso?: string) {
  if (!employeeIds.length) return 0;
  const { data: open } = await admin
    .from("time_entries")
    .select("employee_id")
    .in("employee_id", employeeIds)
    .is("scheduled_job_id", null)
    .is("clock_out", null);
  const on = new Set((open ?? []).map((r: { employee_id: string }) => r.employee_id));
  const now = clockInIso ?? new Date().toISOString();
  const rows = employeeIds
    .filter((id) => !on.has(id))
    .map((id) => ({ org_id: orgId, employee_id: id, clock_in: now, break_minutes: 0, notes: "Work day", location_clock_in: location?.slice(0, 120) ?? null }));
  if (rows.length) {
    const { error } = await admin.from("time_entries").insert(rows);
    if (error) throw new Error(`Could not clock in: ${error.message}`);
  }
  return rows.length;
}

/** Start the day (at the shop or storage). Everyone clocks in for themselves. */
export async function startDay(location?: string | null, backAt?: string | null): Promise<ActionResult> {
  const { org, employee, admin } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  const ids = [employee.id];

  // "I got back from lunch at 1:30": start the clock at that time, not now.
  let clockInIso: string | undefined;
  if (backAt) {
    if (!/^\d{2}:\d{2}$/.test(backAt)) return { error: "Pick the time you got back." };
    const { data: last } = await admin
      .from("time_entries")
      .select("clock_out, notes")
      .eq("employee_id", employee.id)
      .is("scheduled_job_id", null)
      .not("clock_out", "is", null)
      .order("clock_out", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last?.clock_out || last.notes !== "Lunch") return { error: "You're not at lunch." };
    const { loadBusinessRules } = await import("@/lib/schedule-server");
    const { zonedToUtc } = await import("@/lib/time-math");
    const { timezone } = await loadBusinessRules(admin, org.orgId);
    const day = new Date(last.clock_out).toLocaleDateString("en-CA", { timeZone: timezone });
    clockInIso = zonedToUtc(day, backAt, timezone);
    if (clockInIso < last.clock_out) return { error: "That's before you went to lunch." };
    if (Date.parse(clockInIso) > Date.now() + 60_000) return { error: "That time hasn't happened yet." };
  }
  try {
    await startShift(admin, org.orgId, ids, location, clockInIso);
  } catch (e) {
    console.error("[field] startDay failed", employee.id, e);
    return { error: "Couldn't clock you in. Please try again." };
  }
  revalidatePath("/field");
  revalidatePath("/timesheets");
  return { ok: true };
}

/**
 * End the day (back at storage, or at the last job). Only clocks out the person
 * who taps it, so a crew member who goes on to help another crew keeps working.
 * Also stops any job timer they still have running.
 */
export async function endDay(location?: string | null): Promise<ActionResult> {
  const { employee, admin } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  const ids = [employee.id];
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: open } = await admin
    .from("time_entries")
    .select("id, employee_id, clock_in, break_minutes")
    .in("employee_id", ids)
    .is("clock_out", null);
  for (const e of open ?? []) {
    const hours = Math.max(0, (now.getTime() - new Date(e.clock_in).getTime()) / 3_600_000 - (e.break_minutes ?? 0) / 60);
    await admin
      .from("time_entries")
      .update({
        clock_out: nowIso,
        total_hours: Math.round(hours * 100) / 100,
        location_clock_out: location?.slice(0, 120) ?? null,
        updated_at: nowIso,
      })
      .eq("id", e.id);
  }
  revalidatePath("/field");
  revalidatePath("/timesheets");
  return { ok: true };
}

/**
 * Out to lunch: stops the day clock (and any job timer) for the crew, or just
 * this person if they aren't a lead. "Back from lunch" starts the clock again,
 * so lunch is never counted as paid time.
 */
export async function startLunch(location?: string | null): Promise<ActionResult> {
  const { employee, admin } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  const ids = [employee.id];
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: open } = await admin
    .from("time_entries")
    .select("id, employee_id, scheduled_job_id, clock_in, break_minutes")
    .in("employee_id", ids)
    .is("clock_out", null);
  if (!(open ?? []).some((e: any) => !e.scheduled_job_id)) return { error: "Start your day first." };
  for (const e of open ?? []) {
    const hours = Math.max(0, (now.getTime() - new Date(e.clock_in).getTime()) / 3_600_000 - (e.break_minutes ?? 0) / 60);
    await admin
      .from("time_entries")
      .update({
        clock_out: nowIso,
        total_hours: Math.round(hours * 100) / 100,
        location_clock_out: e.employee_id === employee.id ? location?.slice(0, 120) ?? null : null,
        ...(e.scheduled_job_id ? {} : { notes: "Lunch" }),
        updated_at: nowIso,
      })
      .eq("id", e.id);
  }
  revalidatePath("/field", "layout");
  revalidatePath("/timesheets");
  return { ok: true };
}

/** Stop every running timer on this job (the whole crew). */
async function clockOutJob(admin: any, jobId: string, leadId: string, location?: string | null) {
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: openEntries } = await admin
    .from("time_entries")
    .select("id, employee_id, clock_in, break_minutes")
    .eq("scheduled_job_id", jobId)
    .is("clock_out", null);
  for (const entry of openEntries ?? []) {
    const workedMs = now.getTime() - new Date(entry.clock_in).getTime();
    const hours = Math.max(0, workedMs / 3_600_000 - (entry.break_minutes ?? 0) / 60);
    await admin
      .from("time_entries")
      .update({
        clock_out: nowIso,
        total_hours: Math.round(hours * 100) / 100,
        location_clock_out: entry.employee_id === leadId ? location?.slice(0, 120) ?? null : null,
        updated_at: nowIso,
      })
      .eq("id", entry.id);
  }
}

/** Pause the crew's clock (lunch, supply run). The job stays in progress. */
export async function pauseJob(jobId: string, location?: string | null): Promise<ActionResult> {
  const ctx = await loadMyJob(jobId);
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.job.status !== "in_progress") return { error: "This job isn't in progress." };
  await clockOutJob(ctx.admin, jobId, ctx.employee.id, location);
  refreshViews(jobId);
  return { ok: true };
}



/** Stop for today: the crew has to come back to finish. The office reschedules it. */
export async function needsReturnVisit(
  jobId: string,
  reason: ReturnReason,
  details?: string,
  location?: string | null,
): Promise<ActionResult> {
  const ctx = await loadMyJob(jobId);
  if (!ctx.ok) return { error: ctx.error };
  const { admin, org, employee, job } = ctx;
  if (!(reason in RETURN_REASONS)) return { error: "Pick a reason." };
  const note = details?.trim().slice(0, 1000) ?? "";
  if (reason !== "weather" && reason !== "customer" && !note) {
    return { error: "Add a quick note: what's left to do and what to bring next time." };
  }
  if (job.status === "completed") return { error: "This job is already completed." };

  await clockOutJob(admin, jobId, employee.id, location);

  const now = new Date();
  const label = RETURN_REASONS[reason];
  const line = `${employee.name} (${now.toLocaleDateString("en-US")}): Needs return visit, ${label}${note ? `: ${note}` : ""}`;
  const { data: current } = await admin.from("scheduled_jobs").select("internal_notes").eq("id", jobId).single();
  const { error } = await admin
    .from("scheduled_jobs")
    .update({
      status: "needs_return",
      status_key: "needs_return",
      return_reason: note ? `${label}: ${note}` : label,
      return_requested_at: now.toISOString(),
      internal_notes: [current?.internal_notes, line].filter(Boolean).join("\n"),
      updated_at: now.toISOString(),
    })
    .eq("id", jobId)
    .eq("org_id", org.orgId);
  if (error) return { error: "Could not update the job. Please try again." };

  let customerName = "A customer";
  if (job.customerId) {
    const { data: c } = await admin.from("customers").select("full_name, first_name, last_name").eq("id", job.customerId).maybeSingle();
    customerName = c?.full_name || [c?.first_name, c?.last_name].filter(Boolean).join(" ") || customerName;
  }
  try {
    await createNotification({
      orgId: org.orgId,
      type: "job_needs_return",
      title: `Return visit needed: ${customerName}`,
      message: `${employee.name}: ${label}${note ? ` (${note})` : ""}. It's back on the Needs scheduling list.`,
      relatedId: jobId,
      customerId: job.customerId ?? undefined,
    });
  } catch {
    // The status change is what matters; the alert is best effort.
  }

  refreshViews(jobId);
  revalidatePath("/schedule");
  return { ok: true, nextJobId: await findNextJob(org.orgId, employee.id, jobId) };
}

async function findNextJob(orgId: string, employeeId: string, currentJobId: string) {
  const jobs = await getAssignedJobs(orgId, employeeId);
  return jobs.find((j) => j.id !== currentJobId && isOpenStatus(j.status))?.id ?? null;
}

/**
 * "Working with ___ today": join another crew for the day (or go back to your
 * own). Their jobs show up for you, and that crew's lead clocks you in with them.
 */
export async function setHelpingCrew(crewId: string | null): Promise<ActionResult> {
  const { org, employee, admin } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  if (crewId) {
    const { data: crew } = await admin.from("crews").select("id").eq("id", crewId).eq("org_id", org.orgId).maybeSingle();
    if (!crew) return { error: "That crew wasn't found." };
  }
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const { today } = await loadBusinessRules(admin, org.orgId);
  const goingHome = !crewId || crewId === employee.homeCrewId;
  await admin
    .from("employees")
    .update(goingHome ? { helping_crew_id: null, helping_date: null } : { helping_crew_id: crewId, helping_date: today })
    .eq("id", employee.id)
    .eq("org_id", org.orgId);
  revalidatePath("/field", "layout");
  revalidatePath("/schedule");
  return { ok: true };
}


/** Tick an item on the job's materials checklist (anyone on the job can). */
export async function setMaterialChecked(jobId: string, key: string, checked: boolean): Promise<ActionResult> {
  const { org, employee, admin } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  const access = await getAccessibleJob(org.orgId, employee.id, org.role, jobId);
  if (!access?.assigned) return { error: "This job isn't assigned to you." };
  const k = String(key).slice(0, 200);
  const { data } = await admin.from("scheduled_jobs").select("materials_checked").eq("id", jobId).eq("org_id", org.orgId).single();
  const current = { ...((data?.materials_checked as Record<string, string>) ?? {}) };
  if (checked) current[k] = employee.name;
  else delete current[k];
  const { error } = await admin.from("scheduled_jobs").update({ materials_checked: current }).eq("id", jobId).eq("org_id", org.orgId);
  if (error) return { error: "Couldn't save that. Try again." };
  revalidatePath(`/field/jobs/${jobId}`);
  return { ok: true };
}

/** Crew member asks the office to fix a day's times. The office approves or declines. */
export async function requestTimeFix(input: {
  day: string;
  start: string;
  end: string;
  lunchStart?: string;
  lunchEnd?: string;
  reason: string;
}): Promise<ActionResult> {
  const { org, employee, admin } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  const t = /^\d{2}:\d{2}$/;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return { error: "Pick the day." };
  if (!t.test(input.start)) return { error: "Enter your start time." };
  if (input.end && !t.test(input.end)) return { error: "Enter your end time." };
  if (input.end && input.end <= input.start) return { error: "End has to be after start." };
  const hasLunch = Boolean(input.lunchStart || input.lunchEnd);
  if (hasLunch) {
    if (!t.test(input.lunchStart ?? "") || !t.test(input.lunchEnd ?? "")) return { error: "Enter both lunch times, or leave lunch blank." };
    if (!(input.start < input.lunchStart! && input.lunchStart! < input.lunchEnd! && (!input.end || input.lunchEnd! < input.end))) {
      return { error: "Lunch has to fall between your start and end." };
    }
  }
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 3) return { error: "Say what happened (for example: forgot to clock in)." };
  const { error } = await admin.from("time_fix_requests").insert({
    org_id: org.orgId,
    employee_id: employee.id,
    day: input.day,
    start_time: input.start,
    end_time: input.end || null,
    lunch_start: hasLunch ? input.lunchStart : null,
    lunch_end: hasLunch ? input.lunchEnd : null,
    reason,
  });
  if (error) return { error: "Couldn't send the request. Try again." };
  try {
    await createNotification({
      orgId: org.orgId,
      type: "time_fix_request",
      title: `Time fix request: ${employee.name}`,
      message: `${input.day}: ${input.start}–${input.end || "?"}${hasLunch ? `, lunch ${input.lunchStart}–${input.lunchEnd}` : ""}. ${reason}`,
    });
  } catch {
    // The request is saved; the alert is best effort.
  }
  revalidatePath("/field/hours");
  revalidatePath("/timesheets");
  return { ok: true };
}

/**
 * Mark one checklist line. "load:" → loaded | missing, "site:" → have | dont,
 * "step:" → done | cant (with a reason). Anyone on the job can mark it; a
 * Missing / Don't have it flags the owner right away. Pass state null to clear.
 */
export async function setChecklistMark(
  jobId: string,
  key: string,
  state: ChecklistMark["s"] | null,
  reason?: string,
): Promise<ActionResult> {
  const { org, employee, admin } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  const access = await getAccessibleJob(org.orgId, employee.id, org.role, jobId);
  if (!access?.assigned) return { error: "This job isn't assigned to you." };
  const [prefix] = key.split(":");
  const allowed: Record<string, string[]> = { load: ["loaded", "missing"], site: ["have", "dont"], step: ["done", "cant"] };
  if (!allowed[prefix] || (state !== null && !allowed[prefix].includes(state))) return { error: "Unknown checklist item." };
  const why = (reason ?? "").trim().slice(0, 300);
  if (state === "cant" && !why) return { error: "Say why it can't be finished." };

  const { data } = await admin.from("scheduled_jobs").select("job_checklist").eq("id", jobId).eq("org_id", org.orgId).single();
  const marks = { ...((data?.job_checklist as Record<string, ChecklistMark>) ?? {}) };
  const k = key.slice(0, 300);
  const before = marks[k]?.s;
  if (state === null) delete marks[k];
  else marks[k] = { s: state, by: employee.name, at: new Date().toISOString(), ...(why ? { reason: why } : {}) };
  const { error } = await admin.from("scheduled_jobs").update({ job_checklist: marks }).eq("id", jobId).eq("org_id", org.orgId);
  if (error) return { error: "Couldn't save that. Try again." };

  if ((state === "missing" || state === "dont") && before !== state) {
    const item = k.slice(k.indexOf(":") + 1);
    const where = state === "missing" ? "at the shop (not loaded)" : "on site (customer doesn't have it)";
    try {
      await createNotification({
        orgId: org.orgId,
        type: "job_flag",
        title: `Missing: ${item} · ${access.job.customerName}`,
        message: `${employee.name} marked "${item}" missing ${where} for ${access.job.customerName}.`,
        relatedId: jobId,
        customerId: access.job.customerId ?? undefined,
      });
    } catch {
      // Saved; the alert is best effort.
    }
  }
  revalidatePath(`/field/jobs/${jobId}`);
  return { ok: true };
}
