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

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
});

const addonItemSchema = z.object({
  name: z.string().min(1, "Add-on name is required").max(200),
  description: z.string().max(500).optional(),
  price: z.number().min(0, "Price cannot be negative"),
  maxQuantity: z.number().int().positive().max(99).optional(),
});

const createInvoiceSchema = z.object({
  customerId: uuidSchema,
  locationId: uuidSchema.optional(),
  estimateId: uuidSchema.optional(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  totalAmount: z.number().positive("Total amount must be greater than zero").max(1_000_000),
  subtotal: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  dueDate: z.string()
    .min(1, "Due date is required")
    .refine((dateStr) => !isNaN(Date.parse(dateStr)), "Due date must be a valid date"),
  notes: z.string().max(2000).optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
  allowAddons: z.boolean().optional(),
  addonItems: z.array(addonItemSchema).max(20).optional(),
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

  const calculatedSubtotal = Math.round(
    data.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100,
  ) / 100;
  const calculatedTax = Math.round(calculatedSubtotal * ((data.taxRate ?? 0) / 100) * 100) / 100;
  const calculatedTotal = Math.round((calculatedSubtotal + calculatedTax) * 100) / 100;
  if (data.depositAmount && data.depositAmount > calculatedTotal) {
    throw new Error("Deposit cannot exceed the invoice total");
  }

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
      subtotal: calculatedSubtotal,
      tax_rate: data.taxRate ?? 0,
      tax_amount: calculatedTax,
      total_amount: calculatedTotal,
      deposit_amount: data.depositAmount ?? 0,
      balance_due: calculatedTotal,
      due_date: data.dueDate,
      notes: data.notes ?? null,
      status: "draft",
      allow_addons: Boolean(data.allowAddons && data.addonItems && data.addonItems.length > 0),
    })
    .select("id")
    .single();

  if (invErr || !invoice) throw new Error(invErr?.message ?? "Failed to create invoice");

  // Persist line items alongside the invoice so they render on the detail page
  if (data.lineItems.length > 0) {
    const lineItemRows = data.lineItems.map((item, index) => ({
      org_id: org.orgId,
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: Math.round(item.quantity * item.unitPrice * 100) / 100,
      sort_order: index,
    }));
    const { error: lineItemErr } = await supabase.from("invoice_line_items").insert(lineItemRows);
    if (lineItemErr) throw new Error(lineItemErr.message);
  }

  // Persist optional add-on items the customer can choose to add when viewing the invoice
  if (data.allowAddons && data.addonItems && data.addonItems.length > 0) {
    const addonRows = data.addonItems.map((addon, index) => ({
      org_id: org.orgId,
      invoice_id: invoice.id,
      name: addon.name,
      description: addon.description ?? null,
      price: addon.price,
      max_quantity: addon.maxQuantity ?? 1,
      sort_order: index,
    }));
    const { error: addonErr } = await supabase.from("invoice_addon_products").insert(addonRows);
    if (addonErr) throw new Error(addonErr.message);
  }

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
export async function createPaymentAndWorkOrder(data: {
  invoiceId: string;
  customerId: string;
  paymentType: "full" | "deposit";
  amountReceived: number;
  createWorkOrder: boolean;
  notes?: string;
}) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  if (!Number.isFinite(data.amountReceived) || data.amountReceived <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, total_amount, amount_paid, customer_id")
    .eq("id", data.invoiceId)
    .eq("org_id", org.orgId)
    .single();
  if (invoiceError || !invoice) throw new Error("Invoice not found");
  if (invoice.customer_id !== data.customerId) throw new Error("Customer does not match invoice");

  const total = Number(invoice.total_amount ?? 0);
  const previousPaid = Number(invoice.amount_paid ?? 0);
  if (data.amountReceived > Math.max(total - previousPaid, 0)) {
    throw new Error("Payment cannot exceed the remaining balance");
  }

  const newAmountPaid = previousPaid + data.amountReceived;
  const isFullyPaid = newAmountPaid >= total;
  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: newAmountPaid,
      status: isFullyPaid ? "paid" : "sent",
      paid_at: isFullyPaid ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.invoiceId)
    .eq("org_id", org.orgId);
  if (updateError) throw new Error(updateError.message);

  const { error: termsError } = await supabase.from("payment_terms").upsert({
    invoice_id: data.invoiceId,
    org_id: org.orgId,
    payment_type: data.paymentType,
    deposit_amount: data.paymentType === "deposit" ? data.amountReceived : null,
    full_payment_amount: total,
    deposit_paid_date: data.paymentType === "deposit" ? new Date().toISOString() : null,
    full_payment_paid_date: isFullyPaid ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "invoice_id" });
  if (termsError) throw new Error(termsError.message);

  if (data.createWorkOrder && isFullyPaid) {
    const { data: existingJob } = await supabase
      .from("scheduled_jobs")
      .select("id")
      .eq("invoice_id", data.invoiceId)
      .eq("org_id", org.orgId)
      .limit(1)
      .maybeSingle();
    if (!existingJob) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name, address, city, state, zip_code")
        .eq("id", data.customerId)
        .eq("org_id", org.orgId)
        .single();
      await supabase.from("scheduled_jobs").insert({
        org_id: org.orgId,
        customer_id: data.customerId,
        invoice_id: data.invoiceId,
        title: `Pending Installation – ${customer?.name ?? "Customer"}`,
        job_type: "install",
        address: customer?.address ?? null,
        city: customer?.city ?? null,
        state: customer?.state ?? null,
        zip_code: customer?.zip_code ?? null,
        notes: data.notes || "Created after full invoice payment",
        status: "pending",
        status_key: "pending",
        season_year: new Date().getFullYear(),
      });
    }
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${data.invoiceId}`);
  revalidatePath("/jobs");
  revalidatePath("/mapping");
}

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
