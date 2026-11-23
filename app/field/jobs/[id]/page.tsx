import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Home, MapPin, Navigation, Pencil, Phone, User, Wrench } from "lucide-react";

import { getAccessibleJob, getAssignedJobs, getFieldContext, getInstallItems, getOpenTimeEntry, isOpenStatus, crewTextFilter, crewLeadStillWorking, getJobBadges } from "@/lib/field";
import { WorkOrderView, type WorkArea } from "@/components/field/work-order-view";
import { JobActionBar } from "@/components/field/job-action-bar";
import type { FieldPhoto } from "@/components/field/field-photo-gallery";
import { STATUS_LABEL, directionsUrl, formatClock, formatDay, jobTypeLabel, meaningfulTitle } from "@/components/field/format";

export default async function FieldJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org, employee, admin, canManageWorkOrders, canEditWorkOrders, canRunJobs } = await getFieldContext();
  const crewSafeText = await crewTextFilter(org.orgId);

  const access = await getAccessibleJob(org.orgId, employee?.id ?? null, org.role, id, canManageWorkOrders);
  if (!access) notFound();
  const { job, assigned } = access;
  // Installers can finish the job once their crew lead has ended the day.
  const canRunThisJob =
    canRunJobs || (assigned && !(await crewLeadStillWorking(org.orgId, job.crewId ?? employee?.crewId ?? null)));

  const [propertyPhotos, customerPhotos, entries, openEntry, myJobs, items, customerRow] = await Promise.all([
    job.customerId
      ? admin
          .from("property_photos")
          .select("id, photo_url, description, created_at, property_id")
          .eq("org_id", org.orgId)
          .eq("customer_id", job.customerId)
          .order("created_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] as any[] }),
    job.customerId
      ? admin
          .from("customer_photos")
          .select("id, photo_url, description, created_at")
          .eq("customer_id", job.customerId)
          .order("created_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] as any[] }),
    admin
      .from("time_entries")
      .select("clock_in, clock_out, total_hours")
      .eq("scheduled_job_id", job.id),
    employee ? getOpenTimeEntry(employee.id) : Promise.resolve(null),
    employee ? getAssignedJobs(org.orgId, employee.id) : Promise.resolve([]),
    job.customerId ? getInstallItems(org.orgId, job.customerId) : Promise.resolve([]),
    job.customerId
      ? admin.from("customers").select("notes").eq("id", job.customerId).eq("org_id", org.orgId).maybeSingle()
      : Promise.resolve({ data: null as { notes: string | null } | null }),
  ]);
  // Load-out checklist: the install items plus the basics for this kind of customer.
  const [{ data: checkRow }, badgeMap] = await Promise.all([
    admin.from("scheduled_jobs").select("materials_checked").eq("id", job.id).eq("org_id", org.orgId).maybeSingle(),
    getJobBadges(org.orgId, [job]).catch(() => ({} as Record<string, { kind: string }>)),
  ]);
  const kind = (badgeMap as Record<string, { kind: string }>)[job.id]?.kind;
  const firstLine = (d: string) => d.split(/\r?\n/)[0].replace(/\s+/g, " ").trim();
  const loadOut = [
    ...(kind === "past" ? ["Pull the customer's tote"] : kind === "customer_lights" ? [] : ["Load new lights for this job"]),
    ...items.map((i) => firstLine(i.description) + (i.quantity && i.quantity !== 1 ? ` × ${Number(i.quantity.toFixed(2))}` : "")),
    ...(kind === "customer_lights" ? ["Ladders"] : ["Clips", "Extension cords", "Timer", "Ladders"]),
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  // Money never shows on crew screens.
  const notes = [crewSafeText(job.notes), crewSafeText(customerRow.data?.notes)].filter(Boolean).join("\n\n");

  // Show photos of this property first, then the rest of the customer's history.
  const photos: FieldPhoto[] = [
    ...(propertyPhotos.data ?? [])
      .sort((a, b) => Number(b.property_id === job.propertyId) - Number(a.property_id === job.propertyId))
      .map((p) => ({ id: `p-${p.id}`, pathname: p.photo_url, caption: p.description ?? "", takenAt: p.created_at })),
    ...(customerPhotos.data ?? []).map((p) => ({
      id: `c-${p.id}`,
      pathname: p.photo_url,
      caption: p.description ?? "",
      takenAt: p.created_at,
    })),
  ].filter((p) => p.pathname);

  const loggedMs = (entries.data ?? [])
    .filter((e) => e.clock_out)
    .reduce((sum, e) => sum + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()), 0);

  // Group the install list by area so bigger jobs read like a checklist.
  const AREAS: Array<[string, RegExp]> = [
    ["Roofline", /roof|eave|gutter|peak|ridge|gable|fascia|c9|c7/i],
    ["Windows & doors", /window|door|frame|entry/i],
    ["Trees", /tree|trunk|canopy|branch|palm/i],
    ["Garland & wreaths", /garland|wreath|bow|swag/i],
    ["Bushes & ground", /bush|shrub|hedge|net|ground|stake|path|walk|sphere|ball/i],
    ["Columns & railings", /column|pillar|post|rail|banister|fence/i],
  ];
  const areas: WorkArea[] = [];
  for (const it of items) {
    const [name, ...details] = it.description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!name) continue;
    const area = AREAS.find(([, re]) => re.test(name))?.[0] ?? "Other";
    let group = areas.find((a) => a.name === area);
    if (!group) areas.push((group = { name: area, items: [] }));
    group.items.push({
      name,
      qty: Number.isFinite(it.quantity) && it.quantity !== 1 ? ` × ${Number(it.quantity.toFixed(2))}` : "",
      details,
    });
  }
  areas.sort((a, b) => (a.name === "Other" ? 1 : b.name === "Other" ? -1 : 0));
  const isRemoval = job.jobType === "removal";
  const headline =
    meaningfulTitle(job.title, job.customerName) ||
    (items.length ? items.slice(0, 3).map((i) => i.description.split(/\r?\n/)[0].trim()).join(" + ") : "");
  const kindLabel = kind === "past" ? "Past · pull tote" : kind === "customer_lights" ? "Customer lights" : kind === "new" ? "New · new materials" : null;
  const kindClass =
    kind === "past"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : kind === "customer_lights"
        ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
        : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";

  const myOpenEntry = openEntry?.jobId === job.id ? openEntry : null;
  const busyElsewhereJobId = openEntry && openEntry.jobId !== job.id ? openEntry.jobId : null;
  const nextJobId = myJobs.find((j) => j.id !== job.id && isOpenStatus(j.status))?.id ?? null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Brand band */}
      <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2 text-primary-foreground">
        <Link href="/field" className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold">
          <ArrowLeft className="size-5" aria-hidden="true" />
          Work order
        </Link>
        {canEditWorkOrders && job.status !== "completed" && job.status !== "cancelled" ? (
          <Link href={`/field/jobs/${job.id}/edit`} aria-label="Update work order" className="-mr-2 flex size-11 items-center justify-center rounded-md">
            <Pencil className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="size-11" />
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 pb-48 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Customer */}
          <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <h1 className="flex items-center gap-2 text-xl font-bold leading-tight">
              <User className="size-5 shrink-0" aria-hidden="true" />
              {job.customerId ? (
                <Link href={`/field/customers/${job.customerId}`} className="underline-offset-4 hover:underline">{job.customerName}</Link>
              ) : (
                job.customerName
              )}
            </h1>
            {job.customerPhone && (
              <p className="flex items-center gap-2 text-sm"><Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{job.customerPhone}</p>
            )}
            {job.address && (
              <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{job.address}</p>
            )}
            <div className="mt-1 grid grid-cols-2 gap-2">
              {job.address ? (
                <a href={directionsUrl(job.address)} target="_blank" rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground active:opacity-90">
                  <Navigation className="size-4" aria-hidden="true" /> Directions
                </a>
              ) : (
                <span className="flex min-h-12 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">No address</span>
              )}
              {job.customerPhone ? (
                <a href={`tel:${job.customerPhone}`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-primary text-sm font-semibold text-primary active:bg-accent">
                  <Phone className="size-4" aria-hidden="true" /> Call
                </a>
              ) : (
                <span className="flex min-h-12 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">No phone</span>
              )}
            </div>
          </section>

          {/* When */}
          <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">{jobTypeLabel(job.jobType)}</span>
              <span className={`text-xs font-semibold ${job.status === "in_progress" ? "text-primary" : "text-muted-foreground"}`}>
                {STATUS_LABEL[job.status] ?? job.status}
              </span>
              {kindLabel && <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${kindClass}`}>{kindLabel}</span>}
            </div>
            <p className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{formatDay(job.scheduledDate)}</p>
            {job.startTime && (
              <p className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {formatClock(job.startTime)}{job.endTime ? ` – ${formatClock(job.endTime)}` : ""}
              </p>
            )}
          </section>
        </div>

        {/* What we're doing */}
        {headline && (
          <section className="flex items-start gap-3 rounded-xl bg-primary/10 p-4">
            <Wrench className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-lg font-extrabold uppercase leading-tight text-primary">
                {isRemoval ? "Removal" : "Install"}: {headline}
              </p>
              {items.length > 3 && <p className="text-sm text-muted-foreground">+ {items.length - 3} more item{items.length - 3 === 1 ? "" : "s"} below</p>}
            </div>
          </section>
        )}

        <WorkOrderView
          jobId={job.id}
          isRemoval={isRemoval}
          kind={(kind as "past" | "new" | "customer_lights" | undefined) ?? null}
          areas={areas}
          loadOut={job.status === "completed" ? [] : loadOut}
          checked={(checkRow?.materials_checked as Record<string, string>) ?? {}}
          canEdit={assigned}
          notes={notes}
          photos={photos}
        />
      </div>

      {assigned ? (
        <JobActionBar
          jobId={job.id}
          status={job.status}
          clockedInSince={myOpenEntry?.clockIn ?? null}
          loggedMs={loggedMs}
          busyElsewhereJobId={busyElsewhereJobId}
          nextJobId={nextJobId}
          canRun={canRunThisJob}
        />
      ) : (
        <p className="px-4 pb-8 text-center text-sm text-muted-foreground">
          You&apos;re not on this job&apos;s crew. Only assigned crew can start or complete it.
        </p>
      )}
    </div>
  );
}
