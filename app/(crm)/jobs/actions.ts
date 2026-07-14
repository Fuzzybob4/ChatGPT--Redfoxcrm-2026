"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

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

export async function reassignJob(
  jobId: string,
  crewName: string,
  assignedEmployees: string[],
) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("scheduled_jobs")
    .update({
      crew_name: crewName || null,
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
  crewName?: string;
  assignedEmployees?: string[];
  notes?: string;
  seasonYear?: number;
}

export async function createJob(input: CreateJobInput) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .insert({
      org_id: org.orgId,
      customer_id: input.customerId,
      invoice_id: input.invoiceId ?? null,
      estimate_id: input.estimateId ?? null,
      property_id: input.propertyId ?? null,
      location_id: input.locationId ?? null,
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
      crew_name: input.crewName ?? null,
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
  crewName?: string,
  assignedEmployees?: string[],
  notes?: string,
) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  // Fetch the original install job to copy its metadata
  const { data: original, error: fetchErr } = await supabase
    .from("scheduled_jobs")
    .select("customer_id, invoice_id, estimate_id, property_id, location_id, address, city, state, zip_code, season_year, title, org_id")
    .eq("id", installJobId)
    .eq("org_id", org.orgId)
    .single();

  if (fetchErr || !original) throw new Error(fetchErr?.message ?? "Install job not found");

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
      crew_name: crewName ?? null,
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
