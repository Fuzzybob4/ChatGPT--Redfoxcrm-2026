import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Navigation, Phone } from "lucide-react";

import { OFFICE_ROLES, canSeeCustomer, getFieldContext, getInstallItems, isOpenStatus, toFieldJob, crewTextFilter } from "@/lib/field";
import { InstallItems } from "@/components/field/install-items";
import { FieldPhotoGallery, type FieldPhoto } from "@/components/field/field-photo-gallery";
import { directionsUrl, formatClock, formatDay, jobTypeLabel } from "@/components/field/format";

/**
 * What a crew needs at the door: who the customer is and how to reach them,
 * what's being installed (lights, colors, materials from the invoice), notes,
 * and photos of past installs. Crew can only open customers on their jobs.
 */
export default async function FieldCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org, employee, admin, canRunJobs } = await getFieldContext();
  const crewSafeText = await crewTextFilter(org.orgId);
  const office = OFFICE_ROLES.includes(org.role);
  if (!office && !(await canSeeCustomer(org.orgId, employee?.id ?? null, id, canRunJobs))) notFound();

  const [{ data: customer }, { data: jobs }, items, { data: propertyPhotos }, { data: customerPhotos }] =
    await Promise.all([
      admin
        .from("customers")
        .select("id, full_name, first_name, last_name, phone, address, city, state, zip_code, notes")
        .eq("id", id)
        .eq("org_id", org.orgId)
        .maybeSingle(),
      admin
        .from("scheduled_jobs")
        .select("id, title, job_type, status, scheduled_date, start_time, end_time, address, city, state, zip_code, notes, description, customer_id, property_id, assigned_employees, crew_id, crew_name, archived_at, started_at, completed_at")
        .eq("org_id", org.orgId)
        .eq("customer_id", id)
        .neq("status", "cancelled")
        .is("archived_at", null)
        .order("scheduled_date", { ascending: true })
        .limit(20),
      getInstallItems(org.orgId, id),
      admin
        .from("property_photos")
        .select("id, photo_url, description, created_at")
        .eq("org_id", org.orgId)
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(60),
      admin
        .from("customer_photos")
        .select("id, photo_url, description, created_at")
        .eq("org_id", org.orgId)
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);
  if (!customer) notFound();

  const name = customer.full_name?.trim() || `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer";
  const address = [customer.address, customer.city, customer.state, customer.zip_code].filter(Boolean).join(", ");
  const fieldJobs = (jobs ?? []).map(toFieldJob);
  const { todayIn } = await import("@/lib/schedule");
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const today = todayIn((await loadBusinessRules(admin, org.orgId)).timezone);
  const nextJob = fieldJobs.find((j) => isOpenStatus(j.status) && j.scheduledDate >= today) ?? null;

  // Money never shows on crew screens (see crewSafeText).
  const customerNotes = crewSafeText(customer.notes);
  const jobNotes = fieldJobs
    .map((j) => ({ when: `${jobTypeLabel(j.jobType)} ${formatDay(j.scheduledDate)}`, notes: crewSafeText(j.notes) }))
    .filter((n) => n.notes);

  const photos: FieldPhoto[] = [
    ...(propertyPhotos ?? []).map((p: any) => ({ id: `p-${p.id}`, pathname: p.photo_url, caption: p.description ?? "", takenAt: p.created_at })),
    ...(customerPhotos ?? []).map((p: any) => ({ id: `c-${p.id}`, pathname: p.photo_url, caption: p.description ?? "", takenAt: p.created_at })),
  ].filter((p) => p.pathname);

  const btn = "flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground active:bg-accent";
  const none = "flex min-h-14 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground";

  return (
    <div className="flex flex-col gap-5 px-4 pb-10 pt-4">
      <Link href="/field/customers" className="-ml-2 flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Customers
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">{name}</h1>
        {customer.phone && <p className="text-base text-foreground">{customer.phone}</p>}
        {address && <p className="text-sm text-muted-foreground">{address}</p>}
      </header>

      <div className="grid grid-cols-3 gap-2">
        {customer.phone ? (
          <a href={`tel:${customer.phone}`} className={btn}>
            <Phone className="size-4 text-primary" aria-hidden="true" /> Call
          </a>
        ) : (
          <span className={none}>No phone</span>
        )}
        {customer.phone ? (
          <a href={`sms:${customer.phone}`} className={btn}>
            <MessageSquare className="size-4 text-primary" aria-hidden="true" /> Text
          </a>
        ) : (
          <span className={none}>No phone</span>
        )}
        {address ? (
          <a href={directionsUrl(address)} target="_blank" rel="noopener noreferrer" className={btn}>
            <Navigation className="size-4 text-primary" aria-hidden="true" /> Directions
          </a>
        ) : (
          <span className={none}>No address</span>
        )}
      </div>

      {nextJob && (
        <Link href={`/field/jobs/${nextJob.id}`} className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-primary">Next job</span>
          <span className="block font-semibold text-foreground">
            {jobTypeLabel(nextJob.jobType)} · {formatDay(nextJob.scheduledDate)}
            {nextJob.startTime ? ` · ${formatClock(nextJob.startTime)}` : ""}
          </span>
          <span className="text-primary">Open job →</span>
        </Link>
      )}

      <InstallItems items={items} />

      {(customerNotes || jobNotes.length > 0) && (
        <section aria-labelledby="crew-notes-heading" className="flex flex-col gap-3 rounded-xl bg-muted p-4">
          <h2 id="crew-notes-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notes, colors &amp; materials
          </h2>
          {customerNotes && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{customerNotes}</p>}
          {jobNotes.map((n, idx) => (
            <div key={idx} className="text-sm">
              <p className="text-xs font-medium text-muted-foreground">{n.when}</p>
              <p className="whitespace-pre-line leading-relaxed text-foreground">{n.notes}</p>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="photos-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="photos-heading" className="text-base font-semibold text-foreground">Photos of the home</h2>
          <p className="text-sm text-muted-foreground">
            {photos.length === 0 ? "No photos yet." : "Past installs and setup photos."}
          </p>
        </div>
        <FieldPhotoGallery photos={photos} />
      </section>
    </div>
  );
}
