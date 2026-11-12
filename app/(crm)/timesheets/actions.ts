"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBusinessRules } from "@/lib/schedule-server";

export interface DaySegmentInput {
  /** Existing time entry id; omit to add a new block. */
  id?: string;
  /** "HH:MM" local time. */
  clockIn: string;
  /** "HH:MM" local time, or empty if still on the clock. */
  clockOut: string;
}

/** "2026-11-11" + "17:30" in America/Chicago → UTC ISO string. */
function zonedToUtc(day: string, hhmm: string, timeZone: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asLocal - guess)).toISOString();
}

/**
 * Office corrects someone's work-day times for one day. A reason is required;
 * the original times are kept and the entry is marked as edited.
 */
export async function saveDayTimes(
  employeeId: string,
  day: string,
  segments: DaySegmentInput[],
  note: string,
): Promise<{ ok: true } | { error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { error: "Please sign in." };
  if (!["owner", "admin", "manager"].includes(String(org.role ?? "").toLowerCase())) {
    return { error: "Only the owner or a manager can edit time." };
  }
  const reason = note.trim().slice(0, 500);
  if (reason.length < 3) return { error: "Add a short note saying why the time was changed." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Invalid day." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const db = createAdminClient();
  const { data: emp } = await db.from("employees").select("id").eq("id", employeeId).eq("org_id", org.orgId).maybeSingle();
  if (!emp) return { error: "Employee not found." };
  const { timezone } = await loadBusinessRules(db, org.orgId);

  const nowIso = new Date().toISOString();
  for (const seg of segments) {
    if (!/^\d{2}:\d{2}$/.test(seg.clockIn) || (seg.clockOut && !/^\d{2}:\d{2}$/.test(seg.clockOut))) {
      return { error: "Enter times like 8:00 AM." };
    }
    const inIso = zonedToUtc(day, seg.clockIn, timezone);
    const outIso = seg.clockOut ? zonedToUtc(day, seg.clockOut, timezone) : null;
    if (outIso && outIso <= inIso) return { error: "Clock-out has to be after clock-in." };
    const hours = outIso ? Math.round(((Date.parse(outIso) - Date.parse(inIso)) / 3_600_000) * 100) / 100 : null;

    if (seg.id) {
      const { data: cur } = await db
        .from("time_entries")
        .select("id, clock_in, clock_out, original_clock_in, edited_at")
        .eq("id", seg.id)
        .eq("org_id", org.orgId)
        .eq("employee_id", employeeId)
        .maybeSingle();
      if (!cur) continue;
      const changed = Date.parse(cur.clock_in) !== Date.parse(inIso) || (cur.clock_out ? Date.parse(cur.clock_out) : null) !== (outIso ? Date.parse(outIso) : null);
      if (!changed) continue;
      await db
        .from("time_entries")
        .update({
          clock_in: inIso,
          clock_out: outIso,
          total_hours: hours,
          edited_at: nowIso,
          edited_by: user?.id ?? null,
          edit_note: reason,
          // Keep the very first recorded times, even after several edits.
          ...(cur.edited_at ? {} : { original_clock_in: cur.clock_in, original_clock_out: cur.clock_out }),
          updated_at: nowIso,
        })
        .eq("id", seg.id);
    } else {
      await db.from("time_entries").insert({
        org_id: org.orgId,
        employee_id: employeeId,
        scheduled_job_id: null,
        clock_in: inIso,
        clock_out: outIso,
        total_hours: hours,
        break_minutes: 0,
        notes: "Added by office",
        edited_at: nowIso,
        edited_by: user?.id ?? null,
        edit_note: reason,
      });
    }
  }
  revalidatePath("/timesheets");
  revalidatePath("/field/hours");
  return { ok: true };
}
