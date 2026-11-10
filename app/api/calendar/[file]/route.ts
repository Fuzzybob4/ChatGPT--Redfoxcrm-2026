import { createAdminClient } from "@/lib/supabase/admin";
import { buildIcs } from "@/lib/calendar/ics";
import { appBaseUrl } from "@/lib/email/transactional";

export const dynamic = "force-dynamic";

/**
 * Private calendar subscription feed: /api/calendar/<token>.ics
 * Google Calendar ("From URL") and iPhone ("Add Subscribed Calendar") poll
 * this link. The token is the only credential, so it is long and random and
 * can be reset from the Work Orders page.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const token = decodeURIComponent(file ?? "").replace(/\.ics$/i, "");
  if (token.length < 30) return new Response("Not found", { status: 404 });

  const db = createAdminClient();
  const { data: feed } = await db
    .from("calendar_feeds")
    .select("id, org_id, crew_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!feed || feed.revoked_at) return new Response("Not found", { status: 404 });

  const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10);
  let q = db
    .from("scheduled_jobs")
    .select("id, customer_id, title, job_type, scheduled_date, start_time, end_time, address, city, state, zip_code, status, crew_name, notes, updated_at")
    .eq("org_id", feed.org_id)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .is("archived_at", null)
    .order("scheduled_date")
    .limit(5000);
  if (feed.crew_id) q = q.eq("crew_id", feed.crew_id);

  const [{ data: jobs }, { data: profile }, { data: org }, crewRes] = await Promise.all([
    q,
    db.from("business_profiles").select("business_name").eq("org_id", feed.org_id).maybeSingle(),
    db.from("organizations").select("name").eq("id", feed.org_id).maybeSingle(),
    feed.crew_id ? db.from("crews").select("name").eq("id", feed.crew_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const ids = [...new Set((jobs ?? []).map((j: any) => j.customer_id).filter(Boolean))] as string[];
  const customers = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db.from("customers").select("id, full_name, first_name, last_name, phone").in("id", ids.slice(i, i + 300));
    for (const c of data ?? []) customers.set(c.id, c);
  }

  const base = appBaseUrl();
  const events = (jobs ?? []).map((j: any) => {
    const c = j.customer_id ? customers.get(j.customer_id) : null;
    const name = c?.full_name || [c?.first_name, c?.last_name].filter(Boolean).join(" ") || j.title || "Work order";
    const kind = String(j.job_type ?? "").toLowerCase().includes("remov") ? "Removal" : String(j.job_type ?? "").toLowerCase().includes("install") ? "Install" : "Job";
    const status = String(j.status ?? "").toLowerCase();
    return {
      uid: `job-${j.id}@redfoxcrm.com`,
      date: j.scheduled_date,
      startTime: j.start_time,
      endTime: j.end_time,
      summary: `${status === "completed" ? "✓ " : ""}${kind}: ${name}${j.crew_name && !feed.crew_id ? ` (${j.crew_name})` : ""}`,
      location: [j.address, j.city, j.state, j.zip_code].filter(Boolean).join(", ") || null,
      description: [c?.phone ? `Phone: ${c.phone}` : null, j.notes ? `Notes: ${j.notes}` : null, `Open in Red Fox: ${base}/field/jobs/${j.id}`]
        .filter(Boolean)
        .join("\n"),
      url: `${base}/field/jobs/${j.id}`,
      cancelled: status === "cancelled",
      updatedAt: j.updated_at,
    };
  });

  const business = profile?.business_name || org?.name || "Red Fox CRM";
  const calName = crewRes.data?.name ? `${business} – ${crewRes.data.name}` : `${business} work orders`;
  await db.from("calendar_feeds").update({ last_fetched_at: new Date().toISOString() }).eq("id", feed.id);

  return new Response(buildIcs(calName, events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="work-orders.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
