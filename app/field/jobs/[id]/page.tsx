import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Navigation, Pencil, Phone } from "lucide-react";

import { getAccessibleJob, getAssignedJobs, getFieldContext, getOpenTimeEntry, isOpenStatus } from "@/lib/field";
import { JobActionBar } from "@/components/field/job-action-bar";
import { FieldPhotoGallery, type FieldPhoto } from "@/components/field/field-photo-gallery";
import { PhotoCapture } from "@/components/field/photo-capture";
import { STATUS_LABEL, directionsUrl, formatClock, formatDay, jobTypeLabel } from "@/components/field/format";

export default async function FieldJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org, employee, admin, canManageWorkOrders, canEditWorkOrders } = await getFieldContext();

  const access = await getAccessibleJob(org.orgId, employee?.id ?? null, org.role, id, canManageWorkOrders);
  if (!access) notFound();
  const { job, assigned } = access;

  const [propertyPhotos, customerPhotos, entries, openEntry, myJobs] = await Promise.all([
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
  ]);

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

  const myOpenEntry = openEntry?.jobId === job.id ? openEntry : null;
  const busyElsewhereJobId = openEntry && openEntry.jobId !== job.id ? openEntry.jobId : null;
  const nextJobId = myJobs.find((j) => j.id !== job.id && isOpenStatus(j.status))?.id ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-5 px-4 pb-44 pt-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={assigned || !canManageWorkOrders ? "/field" : "/field/homes"}
            className="-ml-2 flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {assigned || !canManageWorkOrders ? "My jobs" : "Homes"}
          </Link>
          {canEditWorkOrders && job.status !== "completed" && job.status !== "cancelled" && (
            <Link
              href={`/field/jobs/${job.id}/edit`}
              className="-mr-2 flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-primary"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Update work order
            </Link>
          )}
        </div>

        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{jobTypeLabel(job.jobType)}</span>
            <span className={job.status === "in_progress" ? "text-primary" : "text-muted-foreground"}>
              {STATUS_LABEL[job.status] ?? job.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">{job.customerName}</h1>
          <p className="text-sm text-muted-foreground">
            {job.title} · {formatDay(job.scheduledDate)}
            {job.startTime ? ` · ${formatClock(job.startTime)}` : ""}
            {job.endTime ? `–${formatClock(job.endTime)}` : ""}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {job.address ? (
            <a
              href={directionsUrl(job.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground active:bg-accent"
            >
              <Navigation className="size-4 text-primary" aria-hidden="true" />
              Directions
            </a>
          ) : (
            <span className="flex min-h-14 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              No address
            </span>
          )}
          {job.customerPhone ? (
            <a
              href={`tel:${job.customerPhone}`}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground active:bg-accent"
            >
              <Phone className="size-4 text-primary" aria-hidden="true" />
              Call customer
            </a>
          ) : (
            <span className="flex min-h-14 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              No phone
            </span>
          )}
        </div>

        {job.address && <p className="text-sm leading-relaxed text-foreground">{job.address}</p>}

        {job.notes && (
          <section aria-labelledby="notes-heading" className="flex flex-col gap-2 rounded-xl bg-muted p-4">
            <h2 id="notes-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Job notes
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{job.notes}</p>
          </section>
        )}

        <section aria-labelledby="photos-heading" className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="photos-heading" className="text-base font-semibold text-foreground">
                Past installs
              </h2>
              <p className="text-sm text-muted-foreground">
                {photos.length === 0
                  ? "No photos yet for this customer."
                  : "How this property was set up before."}
              </p>
            </div>
            {assigned && <PhotoCapture jobId={job.id} />}
          </div>
          <FieldPhotoGallery photos={photos} />
        </section>
      </div>

      {assigned ? (
        <JobActionBar
          jobId={job.id}
          status={job.status}
          clockedInSince={myOpenEntry?.clockIn ?? null}
          loggedMs={loggedMs}
          busyElsewhereJobId={busyElsewhereJobId}
          nextJobId={nextJobId}
        />
      ) : (
        <p className="px-4 pb-8 text-center text-sm text-muted-foreground">
          You&apos;re not on this job&apos;s crew. Only assigned crew can start or complete it.
        </p>
      )}
    </div>
  );
}
