/**
 * Hours worked across a set of time entries, counting any overlapping time
 * only once. Two punches that cover the same minutes (a duplicate entry, an
 * office edit on top of a phone punch, two job timers) never pay twice.
 */
export function mergedHours(
  entries: Array<{ clock_in: string; clock_out: string | null; break_minutes?: number | null }>,
  now: number = Date.now(),
): number {
  const spans = entries
    .map((e) => [new Date(e.clock_in).getTime(), e.clock_out ? new Date(e.clock_out).getTime() : now] as [number, number])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [a, b] of spans) {
    if (curEnd < 0 || a > curEnd) {
      if (curEnd >= 0) total += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) {
      curEnd = b;
    }
  }
  if (curEnd >= 0) total += curEnd - curStart;
  const breaks = entries.reduce((s, e) => s + Number(e.break_minutes ?? 0), 0) * 60_000;
  return Math.max(0, total - breaks) / 3_600_000;
}
