"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { crewForEmployees, resolveCrew } from "@/lib/crews";

// ── Status transition ──────────────────────────────────────────────────────

/**
 * Advance a work order through the status flow:
 *   scheduled → en_route → in_progress → completed
 * Also accepts "cancelled" at any point.
 */
export async function updateJobStatus(
  jobId: string,
  newStatus: "en_route" | "in_progress" | "completed" | "cancelled",
) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: newStatus,
    status_key: newStatus,
    updated_at: now,
  };

  if (newStatus === "en_route")    patch.en_route_at  = now;
  if (newStatus === "in_progress") patch.started_at   = now;
  if (newStatus === "completed")   patch.completed_at = now;

  const { error } = await supabase
    .from("scheduled_jobs")
    .update(patch)
    .eq("id", jobId)
    .eq("org_id", org.orgId);

  if (error) throw new Error(error.message);

  revalidatePath("/jobs");
}

// ── Employee reassignment ──────────────────────────────────────────────────

/** Assign people to a job; the job takes their crew when they share one. */
export async function reassignJob(jobId: string, assignedEmployees: string[]) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const crew = await crewForEmployees(createAdminClient(), org.orgId, assignedEmployees);
  const { error } = await supabase
    .from("scheduled_jobs")
    .update({
      ...(crew ? { crew_id: crew.id, crew_name: crew.name } : {}),
      assigned_employees: assignedEmployees,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("org_id", org.orgId);

  if (error) throw new Error(error.message);

  revalidatePath("/jobs");
}

// ── Create work order (install or removal) ────────────────────────────────

export interface CreateJobInput {
  customerId: string;
  invoiceId?: string;
  estimateId?: string;
  propertyId?: string;
  locationId?: string;
  title: string;
  jobType: "install" | "removal" | "other";
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  /** A crew from the shared crew list. */
  crewId?: string;
  /** Older callers: a crew name, matched to (or added to) the crew list. */
  crewName?: string;
  assignedEmployees?: string[];
  notes?: string;
  seasonYear?: number;
}

export async function createJob(input: CreateJobInput) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  let locationId = input.locationId ?? null;
  if (!locationId) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("location_id")
      .eq("id", input.customerId)
      .eq("org_id", org.orgId)
      .single();
    if (customerError || !customer) throw new Error(customerError?.message ?? "Customer not found");
    locationId = customer.location_id;
  }

  const admin = createAdminClient();
  const crew =
    (await resolveCrew(admin, org.orgId, { crewId: input.crewId, crewName: input.crewName })) ??
    (await crewForEmployees(admin, org.orgId, input.assignedEmployees ?? []));

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .insert({
      org_id: org.orgId,
      customer_id: input.customerId,
      invoice_id: input.invoiceId ?? null,
      estimate_id: input.estimateId ?? null,
      property_id: input.propertyId ?? null,
      location_id: locationId,
      title: input.title,
      job_type: input.jobType,
      scheduled_date: input.scheduledDate,
      start_time: input.startTime,
      end_time: input.endTime,
      duration_minutes: input.durationMinutes ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip_code: input.zipCode ?? null,
      crew_id: crew?.id ?? null,
      crew_name: crew?.name ?? null,
      assigned_employees: input.assignedEmployees ?? [],
      notes: input.notes ?? null,
      season_year: input.seasonYear ?? new Date().getFullYear(),
      status: "scheduled",
      status_key: "scheduled",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/jobs");
  revalidatePath("/mapping");

  return data.id as string;
}

/**
 * Create a removal work order linked to the same customer/invoice as the
 * original install job. Copies address, property, and season details.
 */
export async function createRemovalJob(
  installJobId: string,
  scheduledDate: string,
  startTime: string,
  endTime: string,
  crewId?: string,
  assignedEmployees?: string[],
  notes?: string,
) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  // Fetch the original install job to copy its metadata
  const { data: original, error: fetchErr } = await supabase
    .from("scheduled_jobs")
    .select("customer_id, invoice_id, estimate_id, property_id, location_id, address, city, state, zip_code, season_year, title, org_id, crew_id")
    .eq("id", installJobId)
    .eq("org_id", org.orgId)
    .single();

  if (fetchErr || !original) throw new Error(fetchErr?.message ?? "Install job not found");
  // Same crew as the install unless another is picked.
  const crew = await resolveCrew(createAdminClient(), org.orgId, { crewId: crewId || original.crew_id });

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .insert({
      org_id: org.orgId,
      customer_id: original.customer_id,
      invoice_id: original.invoice_id ?? null,
      estimate_id: original.estimate_id ?? null,
      property_id: original.property_id ?? null,
      location_id: original.location_id ?? null,
      title: `Removal – ${original.title}`,
      job_type: "removal",
      scheduled_date: scheduledDate,
      start_time: startTime,
      end_time: endTime,
      address: original.address ?? null,
      city: original.city ?? null,
      state: original.state ?? null,
      zip_code: original.zip_code ?? null,
      crew_id: crew?.id ?? null,
      crew_name: crew?.name ?? null,
      assigned_employees: assignedEmployees ?? [],
      notes: notes ?? null,
      season_year: original.season_year ?? new Date().getFullYear(),
      status: "scheduled",
      status_key: "scheduled",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/jobs");
  revalidatePath("/mapping");

  return data.id as string;
}

// ── Archive / delete ───────────────────────────────────────────────────────

const DONE = ["completed", "cancelled"];

/**
 * Archive hides finished work orders from the lists and calendars but keeps
 * them, so a customer's history (and their "Installed" stage) stays intact.
 * Only completed or cancelled work orders can be archived.
 */
export async function archiveJobs(jobIds: string[]): Promise<{ archived: number }> {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  const ids = [...new Set(jobIds)].slice(0, 1000);
  if (!ids.length) return { archived: 0 };
  const { data, error } = await createAdminClient()
    .from("scheduled_jobs")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("org_id", org.orgId)
    .in("id", ids)
    .in("status", DONE)
    .is("archived_at", null)
    .select("id");
  if (error) throw new Error("Couldn't archive those work orders.");
  revalidatePath("/jobs");
  revalidatePath("/schedule");
  return { archived: data?.length ?? 0 };
}

/** Every completed and cancelled work order at once. */
export async function archiveAllFinishedJobs(): Promise<{ archived: number }> {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  const { data, error } = await createAdminClient()
    .from("scheduled_jobs")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("org_id", org.orgId)
    .in("status", DONE)
    .is("archived_at", null)
    .select("id");
  if (error) throw new Error("Couldn't archive work orders.");
  revalidatePath("/jobs");
  revalidatePath("/schedule");
  return { archived: data?.length ?? 0 };
}

export async function restoreJob(jobId: string): Promise<void> {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  const { error } = await createAdminClient()
    .from("scheduled_jobs")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("org_id", org.orgId)
    .eq("id", jobId);
  if (error) throw new Error("Couldn't restore that work order.");
  revalidatePath("/jobs");
  revalidatePath("/schedule");
}

/**
 * Permanently deletes a CANCELLED work order (owners and admins). Completed
 * ones are archive-only: deleting them would erase the install from the
 * customer's history.
 */
export async function deleteCancelledJob(jobId: string): Promise<void> {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  if (!["owner", "admin"].includes((org.role || "").toLowerCase())) {
    throw new Error("Only owners and admins can delete work orders.");
  }
  const { data, error } = await createAdminClient()
    .from("scheduled_jobs")
    .delete()
    .eq("org_id", org.orgId)
    .eq("id", jobId)
    .eq("status", "cancelled")
    .select("id");
  if (error) throw new Error("Couldn't delete that work order.");
  if (!data?.length) throw new Error("Only cancelled work orders can be deleted. Archive completed ones instead.");
  revalidatePath("/jobs");
  revalidatePath("/schedule");
}

// ── Schedule the install for an invoice ────────────────────────────────────

/**
 * Creates the install work order for an invoice: same customer, the
 * customer's address, linked to the invoice so it shows on both. It lands on
 * the Work Orders calendar, the Crew Schedule and any synced calendars.
 */
export async function scheduleInvoiceJob(input: {
  invoiceId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  crewId?: string;
  jobType?: "install" | "removal";
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Not signed in." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) return { ok: false, error: "Pick a date." };
  const start = /^\d{2}:\d{2}/.test(input.startTime ?? "") ? input.startTime! : "09:00";
  const end = /^\d{2}:\d{2}/.test(input.endTime ?? "") ? input.endTime! : "12:00";
  if (end <= start) return { ok: false, error: "The end time needs to be after the start time." };

  const db = createAdminClient();
  const { data: invoice } = await db
    .from("invoices")
    .select("id, customer_id, location_id, estimate_id, title")
    .eq("id", input.invoiceId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!invoice?.customer_id) return { ok: false, error: "Invoice not found." };
  const { data: customer } = await db
    .from("customers")
    .select("full_name, first_name, last_name, address, city, state, zip_code, location_id")
    .eq("id", invoice.customer_id)
    .eq("org_id", org.orgId)
    .maybeSingle();
  const crew = await resolveCrew(db, org.orgId, { crewId: input.crewId });
  const type = input.jobType === "removal" ? "removal" : "install";
  const name = customer?.full_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer";

  const { data, error } = await db
    .from("scheduled_jobs")
    .insert({
      org_id: org.orgId,
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      estimate_id: invoice.estimate_id ?? null,
      location_id: invoice.location_id ?? customer?.location_id ?? null,
      title: `${type === "install" ? "Install" : "Removal"} – ${name}`,
      job_type: type,
      scheduled_date: input.date,
      start_time: start,
      end_time: end,
      address: customer?.address ?? null,
      city: customer?.city ?? null,
      state: customer?.state ?? null,
      zip_code: customer?.zip_code ?? null,
      crew_id: crew?.id ?? null,
      crew_name: crew?.name ?? null,
      job_size: "standard",
      season_year: Number(input.date.slice(0, 4)),
      status: "scheduled",
      status_key: "scheduled",
      created_by: org.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't create the work order." };
  revalidatePath("/jobs");
  revalidatePath("/schedule");
  revalidatePath("/mapping");
  revalidatePath(`/invoices/${invoice.id}`);
  return { ok: true, jobId: data.id };
}
