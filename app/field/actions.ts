"use server";

import { revalidatePath } from "next/cache";
import { getAccessibleJob, getAssignedJobs, getFieldContext, isOpenStatus } from "@/lib/field";

type ActionResult = { error: string } | { ok: true; nextJobId?: string | null };

async function loadMyJob(jobId: string) {
  const { org, employee, admin } = await getFieldContext();
  if (!employee) {
    return {
      ok: false as const,
      error: "Your login isn't linked to an employee profile yet. Ask the office to send you a login invite.",
    };
  }

  const access = await getAccessibleJob(org.orgId, employee.id, org.role, jobId);
  if (!access?.assigned) return { ok: false as const, error: "This job isn't assigned to you." };

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
    .is("clock_out", null);

  const otherOpen = (openEntries ?? []).find((e) => e.scheduled_job_id !== jobId);
  if (otherOpen) return { error: "You're still clocked in on another job. Complete it first." };

  const now = new Date().toISOString();
  const alreadyClockedIn = (openEntries ?? []).some((e) => e.scheduled_job_id === jobId);

  if (!alreadyClockedIn) {
    const { error: entryError } = await admin.from("time_entries").insert({
      org_id: org.orgId,
      employee_id: employee.id,
      scheduled_job_id: jobId,
      clock_in: now,
      break_minutes: 0,
      location_clock_in: location?.slice(0, 120) ?? null,
    });
    if (entryError) return { error: "Could not start your timer. Please try again." };
  }

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

async function findNextJob(orgId: string, employeeId: string, currentJobId: string) {
  const jobs = await getAssignedJobs(orgId, employeeId);
  return jobs.find((j) => j.id !== currentJobId && isOpenStatus(j.status))?.id ?? null;
}
