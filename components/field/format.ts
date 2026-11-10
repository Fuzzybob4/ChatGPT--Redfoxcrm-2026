export function formatClock(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

export function formatDay(date: string): string {
  if (!date) return "";
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function jobTypeLabel(jobType: string): string {
  const t = jobType.toLowerCase();
  if (t.includes("remov") || t.includes("takedown")) return "Removal";
  if (t.includes("service") || t.includes("repair")) return "Service";
  return "Install";
}

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  en_route: "On the way",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function directionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** The work order's title, unless it only repeats the job type and customer name. */
export function meaningfulTitle(title: string, customerName: string): string {
  const t = (title ?? "").trim();
  const bare = t.replace(/^(install|removal|service|job)\s*[–-]\s*/i, "").trim().toLowerCase();
  if (!t || bare === (customerName ?? "").trim().toLowerCase() || /^(work order|job)$/i.test(t)) return "";
  return t;
}
