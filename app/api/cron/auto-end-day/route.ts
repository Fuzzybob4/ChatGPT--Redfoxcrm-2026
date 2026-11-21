import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications-server";

export const maxDuration = 120;

/**
 * Nightly (about 7 PM Central): anyone who never tapped End day gets their day
 * ended at the end of their last job timer (or now if they ran no job timer).
 * Each one is marked as auto-ended so the office reviews it on Timesheets.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: open } = await db
    .from("time_entries")
    .select("id, org_id, employee_id, clock_in, break_minutes")
    .is("scheduled_job_id", null)
    .is("clock_out", null)
    .lt("clock_in", new Date(now.getTime() - 60 * 60_000).toISOString());

  const ended: Array<{ employeeId: string; endedAt: string }> = [];
  for (const shift of open ?? []) {
    // Close any job timer they left running.
    const { data: jobTimers } = await db
      .from("time_entries")
      .select("id, clock_in, clock_out")
      .eq("employee_id", shift.employee_id)
      .not("scheduled_job_id", "is", null)
      .gte("clock_in", shift.clock_in);
    for (const t of (jobTimers ?? []).filter((t) => !t.clock_out)) {
      await db
        .from("time_entries")
        .update({
          clock_out: nowIso,
          total_hours: Math.round(((now.getTime() - Date.parse(t.clock_in)) / 3_600_000) * 100) / 100,
          auto_ended: true,
          updated_at: nowIso,
        })
        .eq("id", t.id);
    }
    const lastJobEnd = (jobTimers ?? [])
      .map((t) => (t.clock_out ? Date.parse(t.clock_out) : now.getTime()))
      .reduce((a, b) => Math.max(a, b), 0);
    const end = lastJobEnd > Date.parse(shift.clock_in) ? new Date(lastJobEnd) : now;
    const hours = Math.max(0, (end.getTime() - Date.parse(shift.clock_in)) / 3_600_000 - Number(shift.break_minutes ?? 0) / 60);
    const endLocal = end.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
    await db
      .from("time_entries")
      .update({
        clock_out: end.toISOString(),
        total_hours: Math.round(hours * 100) / 100,
        auto_ended: true,
        edited_at: nowIso,
        edit_note:
          lastJobEnd > Date.parse(shift.clock_in)
            ? `Auto-ended: End day wasn't tapped. Set to the end of their last job (${endLocal}). Please check.`
            : `Auto-ended: End day wasn't tapped and no job timer was run. Ended at ${endLocal}. Please check.`,
        updated_at: nowIso,
      })
      .eq("id", shift.id);
    ended.push({ employeeId: shift.employee_id, endedAt: end.toISOString() });
    try {
      const { data: emp } = await db.from("employees").select("first_name, last_name").eq("id", shift.employee_id).maybeSingle();
      await createNotification({
        orgId: shift.org_id,
        type: "time_auto_ended",
        title: `Day auto-ended: ${[emp?.first_name, emp?.last_name].filter(Boolean).join(" ") || "crew member"}`,
        message: `They never tapped End day. Their day was ended at ${endLocal}. Check it on Timesheets.`,
      });
    } catch {
      // best effort
    }
  }
  return NextResponse.json({ ended });
}
