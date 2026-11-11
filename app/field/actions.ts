"use server";

import { revalidatePath } from "next/cache";
import { getAccessibleJob, getAssignedJobs, getFieldContext, isOpenStatus } from "@/lib/field";
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
    return { ok: false as const, error: "Your crew lead starts, pauses and finishes jobs. You can still add photos." };
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

  const { data: openEntries } = await admin
    .from("time_entries")
    .select("id, scheduled_job_id")
    .eq("employee_id", employee.id)
    .not("scheduled_job_id", "is", null)
    .is("clock_out", null);

  const otherOpen = (openEntries ?? []).find((e) => e.scheduled_job_id !== jobId);
  if (otherOpen) return { error: "You're still clocked in on another job. Complete it first." };

  const now = new Date().toISOString();

  // The lead starts the clock for the whole crew: themselves plus everyone on
  // the job's crew who isn't already on the clock somewhere else.
  const crewId = job.crewId ?? employee.crewId;
  const { data: crewMates } = crewId
    ? await admin.from("employees").select("id").eq("org_id", org.orgId).eq("crew_id", crewId).eq("is_active", true)
    : { data: [] as { id: string }[] };
  const ids = [...new Set([employee.id, ...(crewMates ?? []).map((m: { id: string }) => m.id)])];
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
  // Forgot to start the day? Starting a job starts it for them.
  await startShift(admin, org.orgId, ids, location);

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
async function startShift(admin: any, orgId: string, employeeIds: string[], location?: string | null) {
  if (!employeeIds.length) return 0;
  const { data: open } = await admin
    .from("time_entries")
    .select("employee_id")
    .in("employee_id", employeeIds)
    .is("scheduled_job_id", null)
    .is("clock_out", null);
  const on = new Set((open ?? []).map((r: { employee_id: string }) => r.employee_id));
  const now = new Date().toISOString();
  const rows = employeeIds
    .filter((id) => !on.has(id))
    .map((id) => ({ org_id: orgId, employee_id: id, clock_in: now, break_minutes: 0, notes: "Work day", location_clock_in: location?.slice(0, 120) ?? null }));
  if (rows.length) await admin.from("time_entries").insert(rows);
  return rows.length;
}

/** Who a day-clock tap applies to: a crew lead clocks the whole crew; anyone else, just themselves. */
async function dayCrew(admin: any, orgId: string, employee: { id: string; crewId: string | null }, isLead: boolean) {
  if (!isLead || !employee.crewId) return [employee.id];
  const { data } = await admin.from("employees").select("id").eq("org_id", orgId).eq("crew_id", employee.crewId).eq("is_active", true);
  return [...new Set([employee.id, ...(data ?? []).map((e: { id: string }) => e.id)])];
}

/** Start the day (at the shop, storage, or wherever the crew starts). */
export async function startDay(location?: string | null): Promise<ActionResult> {
  const { org, employee, admin, canRunJobs } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  const ids = await dayCrew(admin, org.orgId, employee, canRunJobs);
  await startShift(admin, org.orgId, ids, location);
  revalidatePath("/field");
  revalidatePath("/timesheets");
  return { ok: true };
}

/** End the day (back at storage, or at the last job). Also stops any job timer still running. */
export async function endDay(location?: string | null): Promise<ActionResult> {
  const { org, employee, admin, canRunJobs } = await getFieldContext();
  if (!employee) return { error: "Your login isn't linked to an employee profile yet." };
  const ids = await dayCrew(admin, org.orgId, employee, canRunJobs);
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
  if (reason === "other" && !note) return { error: "Add a quick note about why." };
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
