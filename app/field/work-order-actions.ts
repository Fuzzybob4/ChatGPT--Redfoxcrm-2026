"use server";

import { revalidatePath } from "next/cache";
import { getFieldContext } from "@/lib/field";
import { getWorkOrderCustomer } from "@/lib/field-homes";

type Result = { error: string } | { ok: true; jobId: string };

export interface WorkOrderInput {
  jobType: "install" | "removal" | "service";
  scheduledDate: string;
  startTime: string;
  endTime: string;
  assignedEmployees: string[];
  notes: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const TYPE_LABEL = { install: "Install", removal: "Removal", service: "Service" } as const;

async function requireManager() {
  const ctx = await getFieldContext();
  if (!ctx.canManageWorkOrders) return { ok: false as const, error: "Only crew leads can manage work orders." };
  return { ok: true as const, ...ctx };
}

async function validate(input: WorkOrderInput, orgId: string, admin: Awaited<ReturnType<typeof getFieldContext>>["admin"]) {
  if (!(input.jobType in TYPE_LABEL)) return "Pick a work order type.";
  if (!DATE_RE.test(input.scheduledDate)) return "Pick a date.";
  if (!TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime)) return "Pick a start and end time.";
  if (input.endTime <= input.startTime) return "End time must be after the start time.";
  if (input.notes.length > 2000) return "Notes are too long.";

  const ids = Array.from(new Set(input.assignedEmployees)).slice(0, 20);
  if (ids.length > 0) {
    const { data } = await admin.from("employees").select("id").eq("org_id", orgId).in("id", ids);
    if ((data ?? []).length !== ids.length) return "One of the selected crew members wasn't found.";
  }
  return null;
}

function refresh(jobId: string) {
  revalidatePath("/field", "layout");
  revalidatePath(`/field/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/mapping");
}

async function crewNameFor(admin: Awaited<ReturnType<typeof getFieldContext>>["admin"], ids: string[]) {
  if (ids.length === 0) return null;
  const { data } = await admin.from("employees").select("full_name, crew_name").in("id", ids);
  const names = (data ?? []).map((e) => e.crew_name?.trim() || e.full_name?.trim()).filter(Boolean);
  return names.length ? Array.from(new Set(names)).join(", ") : null;
}

export async function createFieldWorkOrder(customerId: string, input: WorkOrderInput): Promise<Result> {
  const ctx = await requireManager();
  if (!ctx.ok) return { error: ctx.error };
  const { org, admin } = ctx;

  const invalid = await validate(input, org.orgId, admin);
  if (invalid) return { error: invalid };

  const customer = await getWorkOrderCustomer(org.orgId, customerId);
  if (!customer) return { error: "Customer not found." };

  const assigned = Array.from(new Set(input.assignedEmployees));
  const { data, error } = await admin
    .from("scheduled_jobs")
    .insert({
      org_id: org.orgId,
      customer_id: customer.id,
      property_id: customer.propertyId,
      location_id: customer.locationId,
      title: `${TYPE_LABEL[input.jobType]} – ${customer.name}`,
      job_type: input.jobType,
      scheduled_date: input.scheduledDate,
      start_time: input.startTime,
      end_time: input.endTime,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zip_code: customer.zipCode,
      assigned_employees: assigned,
      crew_name: await crewNameFor(admin, assigned),
      notes: input.notes.trim() || null,
      season_year: Number(input.scheduledDate.slice(0, 4)),
      status: "scheduled",
      status_key: "scheduled",
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't create the work order. Please try again." };
  refresh(data.id);
  return { ok: true, jobId: data.id };
}

export async function updateFieldWorkOrder(jobId: string, input: WorkOrderInput): Promise<Result> {
  const ctx = await requireManager();
  if (!ctx.ok) return { error: ctx.error };
  const { org, admin } = ctx;

  const invalid = await validate(input, org.orgId, admin);
  if (invalid) return { error: invalid };

  const assigned = Array.from(new Set(input.assignedEmployees));
  const { data, error } = await admin
    .from("scheduled_jobs")
    .update({
      job_type: input.jobType,
      scheduled_date: input.scheduledDate,
      start_time: input.startTime,
      end_time: input.endTime,
      assigned_employees: assigned,
      crew_name: await crewNameFor(admin, assigned),
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("org_id", org.orgId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "Couldn't save the work order. Please try again." };
  refresh(jobId);
  return { ok: true, jobId };
}

export async function cancelFieldWorkOrder(jobId: string): Promise<Result> {
  const ctx = await requireManager();
  if (!ctx.ok) return { error: ctx.error };
  const { org, admin } = ctx;

  const { data, error } = await admin
    .from("scheduled_jobs")
    .update({ status: "cancelled", status_key: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("org_id", org.orgId)
    .in("status", ["scheduled", "en_route"])
    .select("id")
    .maybeSingle();

  if (error) return { error: "Couldn't cancel the work order. Please try again." };
  if (!data) return { error: "Only work orders that haven't started can be cancelled." };
  refresh(jobId);
  return { ok: true, jobId };
}
