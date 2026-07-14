"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

export interface CreateInvoiceInput {
  customerId: string;
  locationId?: string;
  title: string;
  description?: string;
  totalAmount: number;
  dueDate: string;
  notes?: string;
  /** If provided, the invoice is linked to this estimate (and estimate → Converted) */
  estimateId?: string;
  /**
   * Work order fields — if supplied, an install work order is auto-created
   * and linked to this invoice.
   */
  workOrder?: {
    scheduledDate: string;
    startTime: string;
    endTime: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    crewName?: string;
    assignedEmployees?: string[];
    notes?: string;
    seasonYear?: number;
  };
}

/**
 * Creates an invoice and, if workOrder details are provided, automatically
 * creates a linked install work order tagged to that invoice.
 *
 * This is the single source of truth for invoice creation — call it from any
 * UI surface (customer page, estimate conversion, quick-create modal, etc.).
 */
export async function createInvoice(input: CreateInvoiceInput) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  // 1. Generate an invoice number (INV-YYYYMMDD-XXXX)
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  const invoiceNumber = `INV-${datePart}-${randomPart}`;

  // 2. Insert the invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      org_id: org.orgId,
      customer_id: input.customerId,
      location_id: input.locationId ?? null,
      estimate_id: input.estimateId ?? null,
      invoice_number: invoiceNumber,
      title: input.title,
      description: input.description ?? null,
      total_amount: input.totalAmount,
      due_date: input.dueDate,
      notes: input.notes ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (invErr || !invoice) throw new Error(invErr?.message ?? "Failed to create invoice");

  // 3. If the invoice came from an estimate, mark it as Converted
  if (input.estimateId) {
    await supabase
      .from("estimates")
      .update({ status: "converted" })
      .eq("id", input.estimateId)
      .eq("org_id", org.orgId);
  }

  // 4. Auto-create an install work order if scheduling details were provided
  if (input.workOrder) {
    const wo = input.workOrder;

    // Fetch customer address for the work order if not explicitly provided
    let address = wo.address;
    let city = wo.city;
    let state = wo.state;
    let zipCode = wo.zipCode;

    if (!address) {
      const { data: customer } = await supabase
        .from("customers")
        .select("address, city, state, zip_code")
        .eq("id", input.customerId)
        .single();
      if (customer) {
        address = customer.address ?? undefined;
        city = customer.city ?? undefined;
        state = customer.state ?? undefined;
        zipCode = customer.zip_code ?? undefined;
      }
    }

    await supabase.from("scheduled_jobs").insert({
      org_id: org.orgId,
      customer_id: input.customerId,
      invoice_id: invoice.id,
      estimate_id: input.estimateId ?? null,
      location_id: input.locationId ?? null,
      title: `Install – ${input.title}`,
      job_type: "install",
      scheduled_date: wo.scheduledDate,
      start_time: wo.startTime,
      end_time: wo.endTime,
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      zip_code: zipCode ?? null,
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
 * Update invoice status (draft → sent, sent → paid, etc.)
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "paid" | "overdue",
) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "paid") patch.amount_paid = null; // handled by separate payment flow

  const { error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", invoiceId)
    .eq("org_id", org.orgId);

  if (error) throw new Error(error.message);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
}
