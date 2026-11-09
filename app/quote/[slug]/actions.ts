"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { measureAddress, type MeasureResult } from "@/lib/quotes/measure";
import { computeQuote, settingsFromRow, type QuoteSelection } from "@/lib/quotes/pricing";
import {
  ESTIMATE_COLUMNS,
  approveEstimateAndCreateInvoice,
  ensurePortalToken,
  newApprovalToken,
  type EstimateRow,
} from "@/lib/estimates/approval";

async function loadSettings(slug: string) {
  const db = createAdminClient();
  const { data } = await db.from("instant_quote_settings").select("*").eq("slug", slug).maybeSingle();
  if (!data || !data.enabled) return null;
  return { db, row: data, settings: settingsFromRow(data) };
}

export async function lookupAddress(slug: string, address: string): Promise<{ ok: true; result: MeasureResult } | { ok: false; error: string }> {
  const found = await loadSettings(slug);
  if (!found) return { ok: false, error: "Online quotes aren't available right now." };
  const clean = (address ?? "").trim().slice(0, 200);
  if (clean.length < 6) return { ok: false, error: "Please enter your full street address." };
  try {
    const result = await measureAddress(clean);
    if (!result) return { ok: false, error: "We couldn't find that address. Please check it and try again." };
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Address lookup isn't working right now. Please try again in a minute." };
  }
}

export interface SubmitQuoteInput {
  selection: QuoteSelection;
  measuredFeet: number | null;
  measurementSource: "satellite" | "customer";
  address: { formatted: string; street: string | null; city: string | null; state: string | null; zip: string | null; lat: number; lng: number };
  contact: { firstName: string; lastName: string; email: string; phone: string };
  signature: string;
  agreed: boolean;
  website?: string; // honeypot
}

export async function submitInstantQuote(
  slug: string,
  input: SubmitQuoteInput,
): Promise<{ ok: true; portalUrl: string; deposit: number } | { ok: false; error: string }> {
  if (input.website) return { ok: false, error: "Something went wrong." };
  const found = await loadSettings(slug);
  if (!found) return { ok: false, error: "Online quotes aren't available right now." };
  const { db, row, settings } = found;
  const orgId = row.org_id as string;

  const first = (input.contact.firstName ?? "").trim().slice(0, 80);
  const last = (input.contact.lastName ?? "").trim().slice(0, 80);
  const email = (input.contact.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = (input.contact.phone ?? "").trim().slice(0, 40);
  const signature = (input.signature ?? "").trim().slice(0, 200);
  if (!first || !email || !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Please enter your name and a valid email." };
  if (signature.length < 2 || !input.agreed) return { ok: false, error: "Please type your name to sign and check the box." };

  const quote = computeQuote(settings, input.selection);
  if (quote.total <= 0) return { ok: false, error: "Please add your roofline or at least one item." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  try {
    // Customer: reuse by email within this business, else create as a lead.
    const { data: existing } = await db.from("customers").select("id").eq("org_id", orgId).ilike("email", email).limit(1).maybeSingle();
    let customerId = existing?.id as string | undefined;
    if (!customerId) {
      const { data: created, error } = await db
        .from("customers")
        .insert({
          org_id: orgId,
          first_name: first,
          last_name: last || "Unknown",
          full_name: `${first} ${last}`.trim(),
          email,
          phone: phone || null,
          address: input.address.street ?? input.address.formatted,
          city: input.address.city,
          state: input.address.state,
          zip_code: input.address.zip,
          lat: input.address.lat,
          lng: input.address.lng,
          status: "lead",
          tags: ["instant-quote"],
          notes: "Came in through the online instant quote.",
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "customer insert failed");
      customerId = created.id;
    }

    const today = new Date();
    const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const description = quote.lines
      .map((l) => (l.label.startsWith("Front roofline") ? `${l.label}: $${l.total.toFixed(2)}` : `${l.label} × ${l.quantity}: $${l.total.toFixed(2)}`))
      .join("\n");
    const measureNote =
      input.measurementSource === "satellite"
        ? `Roofline measured from satellite at ${input.measuredFeet ?? "?"} ft; customer submitted ${input.selection.feet} ft.`
        : `Roofline traced by customer: ${input.selection.feet} ft.`;

    const { data: est, error: estError } = await db
      .from("estimates")
      .insert({
        org_id: orgId,
        customer_id: customerId,
        estimate_number: `EST-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: "Holiday lighting — instant online quote",
        description,
        status: "sent",
        subtotal: quote.total,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: quote.total,
        deposit_percent: settings.depositPercent,
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        notes: `${measureNote} Price is final unless the on-site measurement differs by more than ${settings.tolerancePercent}%.`,
        approval_token: newApprovalToken(),
        sent_at: new Date().toISOString(),
        viewed_at: new Date().toISOString(),
        measured_feet: input.measuredFeet,
        measurement_source: input.measurementSource,
        quote_details: { selection: input.selection, lines: quote.lines, address: input.address, tolerancePercent: settings.tolerancePercent },
        source: "instant_quote",
      })
      .select(ESTIMATE_COLUMNS)
      .single();
    if (estError || !est) throw new Error(estError?.message ?? "estimate insert failed");

    await approveEstimateAndCreateInvoice(db, est as unknown as EstimateRow, { name: signature, ip });
    const token = await ensurePortalToken(db, customerId!, orgId);
    return { ok: true, portalUrl: `/customer-portal/${encodeURIComponent(token)}`, deposit: quote.deposit };
  } catch (err) {
    console.error("[quote] submit failed:", err);
    return { ok: false, error: "We couldn't save your quote. Please try again." };
  }
}
