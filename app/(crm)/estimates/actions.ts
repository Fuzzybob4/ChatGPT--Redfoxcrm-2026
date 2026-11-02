"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

// Requires migrations/20261102_estimate_line_items_ADDITIVE_REVIEW_REQUIRED.sql
// (estimate_line_items table + estimates.tax_rate/tax_amount/discount_amount).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_REGEX, "Invalid ID format");

const DEFAULT_VALID_DAYS = 30;

const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Every line item needs a description").max(500),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
});

const createEstimateSchema = z.object({
  customerId: uuidSchema,
  locationId: uuidSchema.optional(),
  title: z.string().trim().max(200).optional(),
  notes: z.string().max(5000).optional(),
  validUntil: z
    .string()
    .optional()
    .refine((d) => !d || !isNaN(Date.parse(d)), "Valid-until must be a valid date"),
  discount: z.number().min(0, "Discount cannot be negative").optional(),
  taxRate: z.number().min(0).max(100).optional(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;
export type CreateEstimateResult = { ok: true; id: string } | { ok: false; error: string };
export type EstimateDefaults = { taxRate: number; validUntil: string };

type DbError = { code?: string; message?: string; details?: string | null; hint?: string | null } | null | undefined;

function logDbError(scope: string, error: DbError) {
  console.error(`[${scope}] failed`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
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

const MIGRATION_HINT =
  "Estimates can't be saved yet. Apply migrations/20261102_estimate_line_items_ADDITIVE_REVIEW_REQUIRED.sql first. It adds estimate_line_items plus estimates.tax_rate, tax_amount, and discount_amount.";

/** Missing table/column (migration not applied) rather than a data error. */
function schemaNotReadyMessage(error: DbError): string | null {
  const code = error?.code ?? "";
  const text = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`;
  const missing =
    code === "PGRST204" ||
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42703" ||
    /schema cache/i.test(text) ||
    /does not exist/i.test(text) ||
    /could not find the/i.test(text);
  if (!missing) return null;
  const detail = error?.message ? ` Database said: ${error.message}` : "";
  return `${MIGRATION_HINT}${detail}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Org default tax rate (Settings → Tax, tax_settings) or 0, plus a +30 day valid-until. */
export async function getEstimateDefaults(): Promise<EstimateDefaults> {
  const fallback = { taxRate: 0, validUntil: addDaysIso(DEFAULT_VALID_DAYS) };
  try {
    const org = await getCurrentOrg();
    if (!org) return fallback;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tax_settings")
      .select("tax_rate")
      .eq("org_id", org.orgId)
      .eq("is_active", true)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    if (error) {
      logDbError("getEstimateDefaults tax_settings", error);
      return fallback;
    }
    const rate = Number(data?.tax_rate ?? 0);
    return { ...fallback, taxRate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0 };
  } catch (e) {
    console.error("[getEstimateDefaults] unexpected error", e);
    return fallback;
  }
}

/**
 * Creates a draft estimate with line items for the current org. Totals are
 * computed here; nothing the client sends about money besides line items,
 * discount and tax rate is trusted. Returns { ok, error } instead of throwing
 * so production shows the real message instead of the masked digest error.
 */
export async function createEstimate(input: CreateEstimateInput): Promise<CreateEstimateResult> {
  try {
    const parsed = createEstimateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i: { message: string }) => i.message).join(", ") };
    }
    const data = parsed.data;

    const subtotal = round2(data.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0));
    const discount = round2(data.discount ?? 0);
    if (discount > subtotal) return { ok: false, error: "Discount cannot exceed the subtotal" };
    const taxRate = data.taxRate ?? 0;
    const taxAmount = round2((subtotal - discount) * (taxRate / 100));
    const total = round2(subtotal - discount + taxAmount);
    if (total <= 0) return { ok: false, error: "Estimate total must be greater than zero" };

    const supabase = await createClient();
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", data.customerId)
      .eq("org_id", org.orgId)
      .maybeSingle();
    if (custErr) logDbError("createEstimate customer lookup", custErr);
    if (!customer) return { ok: false, error: "Customer not found or does not belong to your organisation" };

    if (data.locationId) {
      const { data: loc, error: locErr } = await supabase
        .from("locations")
        .select("id")
        .eq("id", data.locationId)
        .eq("org_id", org.orgId)
        .maybeSingle();
      if (locErr) logDbError("createEstimate location lookup", locErr);
      if (!loc) return { ok: false, error: "Location not found or does not belong to your organisation" };
    }

    const customerName =
      customer.full_name?.trim() ||
      [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
      "Customer";

    const today = new Date();
    const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const estimateNumber = `EST-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: estimate, error: estErr } = await supabase
      .from("estimates")
      .insert({
        org_id: org.orgId,
        customer_id: data.customerId,
        location_id: data.locationId ?? null,
        estimate_number: estimateNumber,
        title: data.title || `Estimate for ${customerName}`,
        notes: data.notes?.trim() || null,
        status: "draft",
        valid_until: data.validUntil || addDaysIso(DEFAULT_VALID_DAYS),
        subtotal,
        discount_amount: discount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: total,
      })
      .select("id")
      .single();

    if (estErr || !estimate) {
      logDbError("createEstimate insert", estErr);
      return {
        ok: false,
        error: schemaNotReadyMessage(estErr) ?? estErr?.message ?? "Failed to create estimate",
      };
    }

    const { error: liErr } = await supabase.from("estimate_line_items").insert(
      data.lineItems.map((li, index) => ({
        org_id: org.orgId,
        estimate_id: estimate.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unitPrice,
        line_total: round2(li.quantity * li.unitPrice),
        sort_order: index,
      })),
    );
    if (liErr) {
      logDbError("createEstimate line items insert", liErr);
      // Roll back so a retry does not leave an estimate without line items.
      const { error: delErr } = await supabase
        .from("estimates")
        .delete()
        .eq("id", estimate.id)
        .eq("org_id", org.orgId);
      if (delErr) logDbError("createEstimate rollback", delErr);
      return {
        ok: false,
        error: schemaNotReadyMessage(liErr) ?? `Could not save line items: ${liErr.message}`,
      };
    }

    revalidatePath("/estimates");
    revalidatePath(`/estimates/${estimate.id}`);
    return { ok: true, id: estimate.id as string };
  } catch (e) {
    console.error("[createEstimate] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create estimate" };
  }
}
