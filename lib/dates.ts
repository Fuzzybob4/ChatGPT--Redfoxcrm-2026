// Date helpers for calendar-day values (Postgres `date` columns such as
// scheduled_jobs.scheduled_date and invoices.due_date).
//
// `new Date("2026-11-10")` is parsed as UTC midnight, which renders as
// Mon Nov 9 anywhere west of UTC (e.g. America/Chicago). These helpers parse
// the Y-M-D parts as a *local* calendar date so every view shows the same day.
//
// No org-level timezone is stored today, so "local" means the viewer's
// browser timezone. If an org timezone column is added later, pass it as
// `timeZone` to formatDateOnly / formatTime24 callers.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Normalize "2026-11-10", "2026-11-10T00:00:00+00:00", etc. to "2026-11-10". */
export function toDateKey(value: string | null | undefined): string {
  const m = DATE_ONLY.exec(value ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** Parse a calendar date as local noon (noon avoids DST edge cases). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  const m = DATE_ONLY.exec(value ?? "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

export function formatDateOnly(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" },
  fallback = "No date",
): string {
  const d = parseDateOnly(value);
  return d ? d.toLocaleDateString("en-US", options) : fallback;
}

/** "08:00" / "08:00:00" → "8:00 AM". Returns "" for empty/invalid input. */
export function formatTime24(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m[2]} ${suffix}`;
}

/** "Tue, Nov 10 at 8:00 AM" (time part omitted when there is no time). */
export function formatJobWhen(
  date: string | null | undefined,
  time: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const day = formatDateOnly(date, options);
  const t = formatTime24(time);
  return t ? `${day} at ${t}` : day;
}

/** Today's calendar date in the viewer's local timezone, as "YYYY-MM-DD". */
export function todayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
