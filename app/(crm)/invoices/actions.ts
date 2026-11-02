"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { sendEmail } from "@/lib/email/resend";

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
  // Optional. A blank title is filled with the customer name before insert.
  title: z.string().trim().max(200).optional(),
  description: z.string().max(2000).optional(),
  totalAmount: z.number().positive("Total amount must be greater than zero").max(1_000_000),
  subtotal: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  // Optional: defaults to DEFAULT_DUE_DAYS from today when blank.
  dueDate: z.string()
    .optional()
    .refine((dateStr) => !dateStr || !isNaN(Date.parse(dateStr)), "Due date must be a valid date"),
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

// Returns errors instead of throwing: Next.js replaces thrown server-action
// messages in production with "An error occurred in the Server Components
// render", which hides the real cause (see createCustomer).
export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateInvoiceResult = { ok: true; id: string } | { ok: false; error: string };

/** No org payment-terms column exists in the repo, so new invoices are due in 30 days. */
const DEFAULT_DUE_DAYS = 30;

type DbError = { code?: string; message?: string; details?: string | null; hint?: string | null } | null | undefined;

function logDbError(scope: string, error: DbError) {
  console.error(`[${scope}] failed`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

function zodMessage(error: z.ZodError) {
  return error.issues.map((i: { message: string }) => i.message).join(", ");
}

function addDaysIso(days: number) {
  // Calendar date in the server's timezone. toISOString() is UTC and can
  // land on the next day; the form sends the viewer's local date instead.
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type InvoiceDefaults = {
  taxRate: number;
  dueDays: number;
  dueDate: string;
  /** False when tax_settings has no default row, or the table is missing. */
  hasDefaultTax: boolean;
};

/**
 * Defaults for the New Invoice form: the org's default active tax setting
 * (Settings → Tax), or 0 when there is none, and a due date DEFAULT_DUE_DAYS out.
 */
export async function getInvoiceDefaults(): Promise<InvoiceDefaults> {
  const fallback = { taxRate: 0, dueDays: DEFAULT_DUE_DAYS, dueDate: addDaysIso(DEFAULT_DUE_DAYS), hasDefaultTax: false };
  try {
    const org = await getCurrentOrg();
    if (!org) return fallback;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tax_settings")
      .select("tax_rate, is_default")
      .eq("org_id", org.orgId)
      .eq("is_active", true)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      if (error) logDbError("getInvoiceDefaults tax_settings", error);
      return fallback;
    }
    const rate = Number(data.tax_rate ?? 0);
    return {
      ...fallback,
      hasDefaultTax: true,
      taxRate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0,
    };
  } catch (e) {
    console.error("[getInvoiceDefaults] unexpected error", e);
    return fallback;
  }
}

/**
 * Creates an invoice and, if workOrder details are provided, automatically
 * creates a linked install work order tagged to that invoice.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  try {
    const parsed = createInvoiceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const data = parsed.data;

    // Totals are always recomputed on the server; client amounts are ignored.
    const calculatedSubtotal = Math.round(
      data.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100,
    ) / 100;
    const calculatedTax = Math.round(calculatedSubtotal * ((data.taxRate ?? 0) / 100) * 100) / 100;
    const calculatedTotal = Math.round((calculatedSubtotal + calculatedTax) * 100) / 100;
    if (data.depositAmount && data.depositAmount > calculatedTotal) {
      return { ok: false, error: "Deposit cannot exceed the invoice total" };
    }

    const supabase = await createClient();
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };

    // Verify the customer belongs to this org before using their ID
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, address, city, state, zip_code, full_name, first_name, last_name, name")
      .eq("id", data.customerId)
      .eq("org_id", org.orgId)
      .maybeSingle();
    if (custErr) logDbError("createInvoice customer lookup", custErr);
    if (custErr || !customer) {
      return { ok: false, error: "Customer not found or does not belong to your organisation" };
    }

    // Verify the estimate (if provided) belongs to this org
    if (data.estimateId) {
      const { data: est, error: estErr } = await supabase
        .from("estimates")
        .select("id")
        .eq("id", data.estimateId)
        .eq("org_id", org.orgId)
        .maybeSingle();
      if (estErr) logDbError("createInvoice estimate lookup", estErr);
      if (!est) return { ok: false, error: "Estimate not found or does not belong to your organisation" };
    }

    // Verify the location (if provided) belongs to this org
    if (data.locationId) {
      const { data: loc, error: locErr } = await supabase
        .from("locations")
        .select("id")
        .eq("id", data.locationId)
        .eq("org_id", org.orgId)
        .maybeSingle();
      if (locErr) logDbError("createInvoice location lookup", locErr);
      if (!loc) return { ok: false, error: "Location not found or does not belong to your organisation" };
    }

    // Generate invoice number (INV-YYYYMMDD-XXXX)
    const today = new Date();
    const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${datePart}-${randomPart}`;
    const customerName =
      customer.full_name?.trim() ||
      customer.name?.trim() ||
      [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
      "Customer";
    const title = data.title?.trim() || `Invoice for ${customerName}`;

    // NOTE: no estimate_id here. The invoices table has no estimate_id column
    // (PostgREST PGRST204 "Could not find the 'estimate_id' column of
    // 'invoices' in the schema cache" on the PR #26 preview, 2026-11-02).
    // The previous insert always sent estimate_id (as null), so every invoice
    // create failed. The estimate link is kept by marking the estimate
    // "converted" below and on the work order's estimate_id.
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        org_id: org.orgId,
        customer_id: data.customerId,
        location_id: data.locationId ?? null,
        invoice_number: invoiceNumber,
        title,
        description: data.description ?? null,
        subtotal: calculatedSubtotal,
        tax_rate: data.taxRate ?? 0,
        tax_amount: calculatedTax,
        total_amount: calculatedTotal,
        deposit_amount: data.depositAmount ?? 0,
        balance_due: calculatedTotal,
        due_date: data.dueDate || addDaysIso(DEFAULT_DUE_DAYS),
        notes: data.notes ?? null,
        status: "draft",
        allow_addons: Boolean(data.allowAddons && data.addonItems && data.addonItems.length > 0),
      })
      .select("id")
      .single();

    if (invErr || !invoice) {
      logDbError("createInvoice insert", invErr);
      return { ok: false, error: invErr?.message ?? "Failed to create invoice" };
    }

    // Removes a half-created invoice so a retry does not leave duplicates.
    const rollback = async (reason: string, error: DbError) => {
      logDbError(`createInvoice ${reason}`, error);
      const { error: deleteErr } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id)
        .eq("org_id", org.orgId);
      if (deleteErr) logDbError("createInvoice rollback", deleteErr);
    };

    // Persist line items alongside the invoice so they render on the detail page
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
    if (lineItemErr) {
      await rollback("line items insert", lineItemErr);
      return { ok: false, error: `Could not save line items: ${lineItemErr.message}` };
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
      if (addonErr) {
        await rollback("add-ons insert", addonErr);
        return { ok: false, error: `Could not save optional add-ons: ${addonErr.message}` };
      }
    }

    // Mark estimate as converted (best effort; the invoice already exists)
    if (data.estimateId) {
      const { error: convertErr } = await supabase
        .from("estimates")
        .update({ status: "converted" })
        .eq("id", data.estimateId)
        .eq("org_id", org.orgId);
      if (convertErr) logDbError("createInvoice estimate convert", convertErr);
    }

    // Auto-create install work order if scheduling details provided (best effort)
    if (data.workOrder) {
      const wo = data.workOrder;
      const { error: jobErr } = await supabase.from("scheduled_jobs").insert({
        org_id: org.orgId,
        customer_id: data.customerId,
        invoice_id: invoice.id,
        ...(data.estimateId ? { estimate_id: data.estimateId } : {}),
        location_id: data.locationId ?? null,
        title: `Install – ${title}`,
        job_type: "install",
        scheduled_date: wo.scheduledDate,
        start_time: wo.startTime,
        end_time: wo.endTime,
        address: wo.address ?? customer.address ?? null,
        city: wo.city ?? customer.city ?? null,
        state: wo.state ?? customer.state ?? null,
        zip_code: wo.zipCode ?? customer.zip_code ?? null,
        crew_name: wo.crewName ?? null,
        assigned_employees: wo.assignedEmployees ?? [],
        notes: wo.notes ?? null,
        season_year: wo.seasonYear ?? today.getFullYear(),
        status: "scheduled",
        status_key: "scheduled",
      });
      if (jobErr) logDbError("createInvoice work order insert", jobErr);
    }

    revalidatePath("/invoices");
    revalidatePath("/jobs");
    revalidatePath("/mapping");

    return { ok: true, id: invoice.id as string };
  } catch (e) {
    console.error("[createInvoice] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create invoice" };
  }
}

/**
 * Records a payment against an invoice (and optionally queues the install work
 * order) — always verifies org ownership before mutating.
 */
export async function createPaymentAndWorkOrder(data: {
  invoiceId: string;
  customerId: string;
  paymentType: "full" | "deposit";
  amountReceived: number;
  createWorkOrder: boolean;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };
    if (!Number.isFinite(data.amountReceived) || data.amountReceived <= 0) {
      return { ok: false, error: "Payment amount must be greater than zero" };
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, total_amount, amount_paid, customer_id")
      .eq("id", data.invoiceId)
      .eq("org_id", org.orgId)
      .maybeSingle();
    if (invoiceError) logDbError("createPaymentAndWorkOrder invoice lookup", invoiceError);
    if (invoiceError || !invoice) return { ok: false, error: "Invoice not found" };
    if (invoice.customer_id !== data.customerId) return { ok: false, error: "Customer does not match invoice" };

    const total = Number(invoice.total_amount ?? 0);
    const previousPaid = Number(invoice.amount_paid ?? 0);
    if (data.amountReceived > Math.max(total - previousPaid, 0)) {
      return { ok: false, error: "Payment cannot exceed the remaining balance" };
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
    if (updateError) {
      logDbError("createPaymentAndWorkOrder invoice update", updateError);
      return { ok: false, error: updateError.message };
    }

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
    if (termsError) {
      logDbError("createPaymentAndWorkOrder payment_terms upsert", termsError);
      return { ok: false, error: termsError.message };
    }

    if (data.createWorkOrder && isFullyPaid) {
      const { data: existingJob } = await supabase
        .from("scheduled_jobs")
        .select("id")
        .eq("invoice_id", data.invoiceId)
        .eq("org_id", org.orgId)
        .limit(1)
        .maybeSingle();
      if (!existingJob) {
        // select("*"): the old select named a "name" column, but customers is
        // written with full_name / first_name (customers/actions.ts), so a
        // missing column would have failed the lookup silently.
        const { data: customer } = await supabase
          .from("customers")
          .select("*")
          .eq("id", data.customerId)
          .eq("org_id", org.orgId)
          .maybeSingle();
        const { error: jobErr } = await supabase.from("scheduled_jobs").insert({
          org_id: org.orgId,
          customer_id: data.customerId,
          invoice_id: data.invoiceId,
          title: `Pending Installation – ${
            customer?.full_name ||
            customer?.name ||
            [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
            "Customer"
          }`,
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
        if (jobErr) logDbError("createPaymentAndWorkOrder work order insert", jobErr);
      }
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${data.invoiceId}`);
    revalidatePath("/jobs");
    revalidatePath("/mapping");
    return { ok: true };
  } catch (e) {
    console.error("[createPaymentAndWorkOrder] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to record payment" };
  }
}

/**
 * Update invoice status — always verifies org ownership before mutating.
 * NOTE: "sent" only changes the status; no email is sent to the customer.
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "paid" | "overdue",
): Promise<ActionResult> {
  try {
    const parsed = updateStatusSchema.safeParse({ invoiceId, status });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };

    const supabase = await createClient();
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "paid") {
      patch.paid_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .from("invoices")
      .update(patch)
      .eq("id", invoiceId)
      .eq("org_id", org.orgId) // ownership check in the WHERE clause
      .select("id");

    if (error) {
      logDbError("updateInvoiceStatus", error);
      return { ok: false, error: error.message };
    }
    if (!updated || updated.length === 0) return { ok: false, error: "Invoice not found" };

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    console.error("[updateInvoiceStatus] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update invoice" };
  }
}

/**
 * Emails an invoice and, only after the email is accepted, marks it sent.
 * Does not throw: a missing address or a missing RESEND_API_KEY comes back
 * as { ok: false, error } so the button can show it.
 */
export async function sendInvoice(invoiceId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, due_date, customer_id, title")
      .eq("id", invoiceId)
      .eq("org_id", org.orgId)
      .maybeSingle();
    if (invoiceError) logDbError("sendInvoice lookup", invoiceError);
    if (invoiceError || !invoice) return { ok: false, error: invoiceError?.message ?? "Invoice not found" };

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("email, full_name, first_name, last_name, name")
      .eq("id", invoice.customer_id)
      .eq("org_id", org.orgId)
      .maybeSingle();
    if (customerError) logDbError("sendInvoice customer", customerError);
    const email = String(customer?.email ?? "").trim();
    if (!email) {
      return { ok: false, error: "This customer has no email address, so the invoice was not sent." };
    }

    const customerName =
      customer?.full_name?.trim() ||
      customer?.name?.trim() ||
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim() ||
      "there";
    const due = String(invoice.due_date ?? "").slice(0, 10) || "the due date on the invoice";
    const total = Number(invoice.total_amount ?? 0).toFixed(2);
    const html = `<p>Hi ${customerName},</p><p>Invoice <strong>${invoice.invoice_number}</strong>${invoice.title ? ` (${invoice.title})` : ""} for $${total} is ready. It is due ${due}.</p><p>${org.businessName || org.orgName}</p>`;

    try {
      const sent = await sendEmail({
        to: email,
        subject: `Invoice ${invoice.invoice_number} from ${org.businessName || org.orgName}`,
        html,
      });
      if (sent.error) {
        console.error("[sendInvoice] resend rejected", sent.error);
        return { ok: false, error: sent.error.message || "The email service rejected this invoice." };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not send email";
      console.error("[sendInvoice] email failed", e);
      if (/RESEND_API_KEY/i.test(message)) {
        return {
          ok: false,
          error: "Email is not configured. Set RESEND_API_KEY. The default from-address is RedFox CRM <onboarding@resend.dev>, which only delivers to the Resend account owner until a verified domain is set.",
        };
      }
      return { ok: false, error: message };
    }

    const { error: statusError } = await supabase
      .from("invoices")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("org_id", org.orgId);
    if (statusError) {
      logDbError("sendInvoice status", statusError);
      return { ok: false, error: `The email was sent, but the invoice status did not update: ${statusError.message}` };
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    console.error("[sendInvoice] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send invoice" };
  }
}
