/**
 * Crew scheduling helpers shared by the Schedule page and its server actions.
 *
 * Capacity is counted in "job points": a standard install is 1 point, a small
 * one 0.75 (four fit in a 3-point day), a large one 1.5 (two fill a day).
 */

export type JobSize = "small" | "standard" | "large";

export const JOB_SIZES: Record<JobSize, { label: string; points: number }> = {
  small: { label: "Small", points: 0.75 },
  standard: { label: "Standard", points: 1 },
  large: { label: "Large", points: 1.5 },
};

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat

export const OPEN_JOB_STATUSES = ["scheduled", "en_route", "in_progress"];

export function jobPoints(size: string | null | undefined): number {
  return JOB_SIZES[(size as JobSize) ?? "standard"]?.points ?? 1;
}

/** YYYY-MM-DD for a Date, in local time. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00`).getDay();
}

export function isWorkDay(day: string, workDays: number[], daysOff: Set<string>): boolean {
  return workDays.includes(weekdayOf(day)) && !daysOff.has(day);
}

/** The first work day strictly after `day`. */
export function nextWorkDay(day: string, workDays: number[], daysOff: Set<string>): string {
  const days = workDays.length ? workDays : DEFAULT_WORK_DAYS;
  let d = addDays(day, 1);
  for (let i = 0; i < 400 && !isWorkDay(d, days, daysOff); i++) d = addDays(d, 1);
  return d;
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const wd = weekdayOf(day);
  return addDays(day, wd === 0 ? -6 : 1 - wd);
}

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface PlanCustomer {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  /** When they booked (deposit/invoice date): first come, first served. */
  bookedAt: string;
}

export interface PlanCrew {
  id: string;
  name: string;
  capacity: number;
}

export interface PlanSlot {
  customerId: string;
  name: string;
  address: string;
  date: string;
  crewId: string;
  crewName: string;
}

/**
 * Fill open crew capacity day by day. Each crew-day starts with the
 * longest-waiting customer, then adds the nearest remaining homes so crews
 * aren't driving across town between installs.
 */
export function planAutoSchedule(opts: {
  customers: PlanCustomer[];
  crews: PlanCrew[];
  startDate: string;
  workDays: number[];
  daysOff: Set<string>;
  /** Points already booked, keyed `${date}|${crewId}`. */
  booked: Map<string, number>;
  maxDays?: number;
}): PlanSlot[] {
  const remaining = [...opts.customers].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
  const crews = opts.crews.filter((c) => c.capacity > 0);
  const plan: PlanSlot[] = [];
  if (!crews.length) return plan;

  let day = isWorkDay(opts.startDate, opts.workDays, opts.daysOff)
    ? opts.startDate
    : nextWorkDay(opts.startDate, opts.workDays, opts.daysOff);

  for (let n = 0; n < (opts.maxDays ?? 90) && remaining.length; n++) {
    for (const crew of crews) {
      let free = crew.capacity - (opts.booked.get(`${day}|${crew.id}`) ?? 0);
      if (free < 1 || !remaining.length) continue;
      const seed = remaining.shift()!;
      const chain = [seed];
      free -= 1;
      while (free >= 1 && remaining.length) {
        const last = chain[chain.length - 1];
        let best = 0;
        if (last.lat != null && last.lng != null) {
          let bestDist = Infinity;
          remaining.forEach((c, i) => {
            const d = c.lat != null && c.lng != null ? milesBetween(last as any, c as any) : 9999;
            if (d < bestDist) { bestDist = d; best = i; }
          });
        }
        chain.push(remaining.splice(best, 1)[0]);
        free -= 1;
      }
      for (const c of chain) {
        plan.push({ customerId: c.id, name: c.name, address: c.address, date: day, crewId: crew.id, crewName: crew.name });
      }
    }
    day = nextWorkDay(day, opts.workDays, opts.daysOff);
  }
  return plan;
}
