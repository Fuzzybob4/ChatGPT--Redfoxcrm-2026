import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { ScheduleBoard, type BoardJob } from "@/components/schedule/schedule-board";
import { isEmailConfigured } from "@/lib/email/resend";
import { addDays, weekStart, ymd } from "@/lib/schedule";
import { loadNeedsScheduling, loadScheduleSettings } from "@/lib/schedule-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule - RedFox CRM" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");
  const { week } = await searchParams;
  const start = weekStart(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : ymd(new Date()));
  const end = addDays(start, 6);

  const db = createAdminClient();
  const [settings, needs, { data: jobs }] = await Promise.all([
    loadScheduleSettings(db, org.orgId),
    loadNeedsScheduling(db, org.orgId),
    db
      .from("scheduled_jobs")
      .select("id, customer_id, title, job_type, scheduled_date, start_time, status, crew_id, crew_name, job_size, address, city")
      .eq("org_id", org.orgId)
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .neq("status", "cancelled")
      .is("archived_at", null)
      .order("scheduled_date"),
  ]);

  const customerIds = [...new Set((jobs ?? []).map((j: any) => j.customer_id).filter(Boolean))] as string[];
  const { data: customers } = customerIds.length
    ? await db.from("customers").select("id, full_name, first_name, last_name, phone").in("id", customerIds)
    : { data: [] as any[] };
  const byId = new Map<string, any>((customers ?? []).map((c: any) => [c.id, c]));

  // Jobs that still only carry a typed crew name get matched to the crew.
  const crewByName = new Map(settings.crews.map((c) => [c.name.toLowerCase(), c.id]));
  const boardJobs: BoardJob[] = (jobs ?? []).map((j: any) => {
    const c = j.customer_id ? byId.get(j.customer_id) : null;
    return {
      id: j.id,
      customerId: j.customer_id,
      customerName: c?.full_name || [c?.first_name, c?.last_name].filter(Boolean).join(" ") || j.title || "Job",
      phone: c?.phone ?? null,
      address: [j.address, j.city].filter(Boolean).join(", "),
      date: j.scheduled_date,
      startTime: j.start_time ? String(j.start_time).slice(0, 5) : null,
      crewId: j.crew_id ?? (j.crew_name ? crewByName.get(String(j.crew_name).toLowerCase()) ?? null : null),
      size: (j.job_size ?? "standard") as BoardJob["size"],
      status: String(j.status ?? "scheduled").toLowerCase(),
      jobType: String(j.job_type ?? "install").toLowerCase(),
    };
  });

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader title="Schedule" description="Crews, install days, and rain days" />
      <div className="flex-1 overflow-y-auto">
        <ScheduleBoard
          weekStart={start}
          today={ymd(new Date())}
          crews={settings.crews}
          workDays={settings.workDays}
          daysOff={settings.daysOff.map((d) => d.day)}
          notifyOnMove={settings.notifyOnMove}
          emailConfigured={isEmailConfigured()}
          jobs={boardJobs}
          needs={needs.map((n) => ({ id: n.id, name: n.name, address: n.address, phone: n.phone }))}
          canManage={["owner", "admin", "manager"].includes((org.role || "").toLowerCase())}
        />
      </div>
    </div>
  );
}
