"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

// ── Input schemas ─────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_REGEX, "Invalid ID format");

const workOrderSchema = z.object({
  scheduledDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  crewName: z.string().optional(),
  assignedEmployees: z.array(z.string()).optional(),
  notes: z.string().optional(),
  seasonYear: z.number().int().min(2000).max(2100).optional(),
});

const createInvoiceSchema = z.object({
  customerId: uuidSchema,
  locationId: uuidSchema.optional(),
  estimateId: uuidSchema.optional(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  totalAmount: z.number().positive("Total amount must be greater than zero").max(1_000_000),
  dueDate: z.string()
    .min(1, "Due date is required")
    .refine((dateStr) => !isNaN(Date.parse(dateStr)), "Due date must be a valid date"),
  notes: z.string().max(2000).optional(),
  workOrder: workOrderSchema.optional(),
});

const updateStatusSchema = z.object({
  invoiceId: uuidSchema,
  status: z.enum(["draft", "sent", "paid", "overdue"]),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/**
 * Creates an invoice and, if workOrder details are provided, automatically
 * creates a linked install work order tagged to that invoice.
 */
export async function createInvoice(input: CreateInvoiceInput) {
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i: { message: string }) => i.message).join(", "));
  }
  const data = parsed.data;

  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  // Verify the customer belongs to this org before using their ID
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, address, city, state, zip_code")
    .eq("id", data.customerId)
    .eq("org_id", org.orgId)
    .single();

  if (custErr || !customer) {
    throw new Error("Customer not found or does not belong to your organisation");
  }

  // Verify the estimate (if provided) belongs to this org
  if (data.estimateId) {
    const { data: est } = await supabase
      .from("estimates")
      .select("id")
      .eq("id", data.estimateId)
      .eq("org_id", org.orgId)
      .single();
    if (!est) throw new Error("Estimate not found or does not belong to your organisation");
  }

  // Verify the location (if provided) belongs to this org
  if (data.locationId) {
    const { data: loc } = await supabase
      .from("locations")
      .select("id")
      .eq("id", data.locationId)
      .eq("org_id", org.orgId)
      .single();
    if (!loc) throw new Error("Location not found or does not belong to your organisation");
  }

  // Generate invoice number (INV-YYYYMMDD-XXXX)
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  const invoiceNumber = `INV-${datePart}-${randomPart}`;

  // Insert the invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      org_id: org.orgId,
      customer_id: data.customerId,
      location_id: data.locationId ?? null,
      estimate_id: data.estimateId ?? null,
      invoice_number: invoiceNumber,
      title: data.title,
      description: data.description ?? null,
      total_amount: data.totalAmount,
      due_date: data.dueDate,
      notes: data.notes ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (invErr || !invoice) throw new Error(invErr?.message ?? "Failed to create invoice");

  // Mark estimate as converted
  if (data.estimateId) {
    await supabase
      .from("estimates")
      .update({ status: "converted" })
      .eq("id", data.estimateId)
      .eq("org_id", org.orgId);
  }

  // Auto-create install work order if scheduling details provided
  if (data.workOrder) {
    const wo = data.workOrder;
    const address = wo.address ?? customer.address ?? null;
    const city = wo.city ?? customer.city ?? null;
    const state = wo.state ?? customer.state ?? null;
    const zipCode = wo.zipCode ?? customer.zip_code ?? null;

    await supabase.from("scheduled_jobs").insert({
      org_id: org.orgId,
      customer_id: data.customerId,
      invoice_id: invoice.id,
      estimate_id: data.estimateId ?? null,
      location_id: data.locationId ?? null,
      title: `Install – ${data.title}`,
      job_type: "install",
      scheduled_date: wo.scheduledDate,
      start_time: wo.startTime,
      end_time: wo.endTime,
      address,
      city,
      state,
      zip_code: zipCode,
      crew_name: wo.crewName ?? null,
      assigned_employees: wo.assignedEmployees ?? [],
      notes: wo.notes ?? null,
      season_year: wo.seasonYear ?? today.getFullYear(),
      status: "scheduled",
      status_key: "scheduled",
    });
  }

  revalidatePath("/invoices");
  revalidatePath("/jobs");
  revalidatePath("/mapping");

  return invoice.id as string;
}

/**
 * Update invoice status — always verifies org ownership before mutating.
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "paid" | "overdue",
) {
  const parsed = updateStatusSchema.safeParse({ invoiceId, status });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i: { message: string }) => i.message).join(", "));
  }

  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "paid") {
    patch.paid_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", invoiceId)
    .eq("org_id", org.orgId); // ownership check in the WHERE clause

  if (error) throw new Error(error.message);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
}
