import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeMissingCustomers } from "@/lib/integrations/hubspot";
import {
  getSquareAccessToken,
  mapSquareCustomer,
  mapSquareInvoiceAmounts,
  phoneKey,
  squareGet,
  type SquareCustomer,
  type SquareInvoice,
} from "@/lib/integrations/square";

export interface SquareSyncSummary {
  customersCreated: number;
  customersLinked: number;
  invoicesCreated: number;
  invoicesUpdated: number;
  invoicesSkipped: number;
  mapped: number;
}

const LOCK_MS = 10 * 60 * 1000;
const AUTO_SYNC_EVERY_MS = 10 * 60 * 1000;

/**
 * Pulls Square customers and invoices into one org. Customers are matched by
 * Square ID, then email/phone (linked, never overwritten). Invoices are keyed
 * by Square invoice ID, so re-running updates status and amount paid — this
 * is how a Square payment marks the Red Fox invoice paid.
 * Returns null if a sync for this org is already running.
 */
export async function runSquareSync(orgId: string, { geocodeBudgetMs = 120_000 } = {}): Promise<SquareSyncSummary | null> {
  const db = createAdminClient();
  const now = new Date();

  const { data: claimed, error: claimError } = await db
    .from("org_integrations")
    .update({ sync_started_at: now.toISOString() })
    .eq("org_id", orgId)
    .eq("provider", "square")
    .or(`sync_started_at.is.null,sync_started_at.lt.${new Date(now.getTime() - LOCK_MS).toISOString()}`)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return null;

  try {
    const token = await getSquareAccessToken(orgId);

    // ── Customers ──
    const squareCustomers: SquareCustomer[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 500; page++) {
      const q = new URLSearchParams({ limit: "100" });
      if (cursor) q.set("cursor", cursor);
      const data = await squareGet<{ customers?: SquareCustomer[]; cursor?: string }>(token, `/v2/customers?${q}`);
      squareCustomers.push(...(data.customers ?? []));
      cursor = data.cursor;
      if (!cursor) break;
    }

    const existing: Array<Record<string, any>> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("customers")
        .select("id, email, phone, square_customer_id")
        .eq("org_id", orgId)
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      existing.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const bySquareId = new Map<string, string>();
    const byEmail = new Map<string, Record<string, any>>();
    const byPhone = new Map<string, Record<string, any>>();
    for (const c of existing) {
      if (c.square_customer_id) bySquareId.set(c.square_customer_id, c.id);
      if (c.email) byEmail.set(String(c.email).toLowerCase(), c);
      const pk = phoneKey(c.phone);
      if (pk) byPhone.set(pk, c);
    }

    const { data: exclusions } = await db
      .from("integration_import_exclusions")
      .select("external_id")
      .eq("org_id", orgId)
      .eq("provider", "square");
    const excluded = new Set((exclusions ?? []).map((e) => e.external_id as string));

    const toInsert: Array<Record<string, any>> = [];
    let customersLinked = 0;
    for (const sc of squareCustomers) {
      if (bySquareId.has(sc.id) || excluded.has(sc.id)) continue;
      const row = mapSquareCustomer(sc);
      if (!row) continue;
      const pk = phoneKey(row.phone);
      const match = (row.email && byEmail.get(row.email)) || (pk && byPhone.get(pk)) || null;
      if (match) {
        if (!match.square_customer_id) {
          const { error } = await db
            .from("customers")
            .update({ square_customer_id: sc.id })
            .eq("id", match.id)
            .eq("org_id", orgId);
          if (!error) {
            match.square_customer_id = sc.id;
            bySquareId.set(sc.id, match.id);
            customersLinked++;
          }
        }
        continue;
      }
      toInsert.push({ ...row, org_id: orgId });
      if (row.email) byEmail.set(row.email, { id: "pending", square_customer_id: sc.id });
      if (pk) byPhone.set(pk, { id: "pending", square_customer_id: sc.id });
    }
    let customersCreated = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const { data, error } = await db
        .from("customers")
        .insert(toInsert.slice(i, i + 500))
        .select("id, square_customer_id");
      if (error) throw error;
      for (const c of data ?? []) if (c.square_customer_id) bySquareId.set(c.square_customer_id, c.id);
      customersCreated += data?.length ?? 0;
    }

    // ── Invoices (per location) ──
    const { locations } = await squareGet<{ locations?: Array<{ id: string; status?: string }> }>(token, "/v2/locations");
    const squareInvoices: SquareInvoice[] = [];
    for (const loc of locations ?? []) {
      let invCursor: string | undefined;
      for (let page = 0; page < 200; page++) {
        const q = new URLSearchParams({ location_id: loc.id, limit: "200" });
        if (invCursor) q.set("cursor", invCursor);
        const data = await squareGet<{ invoices?: SquareInvoice[]; cursor?: string }>(token, `/v2/invoices?${q}`);
        squareInvoices.push(...(data.invoices ?? []));
        invCursor = data.cursor;
        if (!invCursor) break;
      }
    }

    const { data: knownInvoices } = await db
      .from("invoices")
      .select("id, square_invoice_id, status, amount_paid")
      .eq("org_id", orgId)
      .not("square_invoice_id", "is", null);
    const invoiceBySquareId = new Map((knownInvoices ?? []).map((i) => [i.square_invoice_id as string, i]));

    let invoicesCreated = 0;
    let invoicesUpdated = 0;
    let invoicesSkipped = 0;
    for (const si of squareInvoices) {
      const a = mapSquareInvoiceAmounts(si);
      if ((si.status ?? "").toUpperCase() === "DRAFT") { invoicesSkipped++; continue; }
      const known = invoiceBySquareId.get(si.id);
      const paidAt = a.paymentState === "paid" ? si.updated_at ?? now.toISOString() : null;

      if (known) {
        if (known.status === a.status && Number(known.amount_paid ?? 0) === a.paid) { invoicesSkipped++; continue; }
        const { error } = await db
          .from("invoices")
          .update({
            status: a.status,
            payment_state: a.paymentState,
            amount_paid: a.paid,
            balance_due: Math.max(a.total - a.paid, 0),
            paid_at: paidAt,
            updated_at: now.toISOString(),
          })
          .eq("id", known.id)
          .eq("org_id", orgId);
        if (!error) invoicesUpdated++;
        continue;
      }

      const customerId = si.primary_recipient?.customer_id ? bySquareId.get(si.primary_recipient.customer_id) : undefined;
      if (!customerId) { invoicesSkipped++; continue; }
      const title = si.title || `Square invoice ${si.invoice_number ?? ""}`.trim();
      const { data: created, error } = await db
        .from("invoices")
        .insert({
          org_id: orgId,
          customer_id: customerId,
          square_invoice_id: si.id,
          invoice_number: si.invoice_number ? `SQ-${si.invoice_number}` : `SQ-${si.id.slice(-6)}`,
          title,
          description: si.description ?? null,
          subtotal: a.total,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: a.total,
          deposit_amount: a.deposit,
          amount_paid: a.paid,
          balance_due: Math.max(a.total - a.paid, 0),
          due_date: a.due,
          status: a.status,
          payment_state: a.paymentState,
          payment_method: "square",
          stripe_payment_link: si.public_url ?? null,
          sent_at: si.created_at ?? null,
          paid_at: paidAt,
          notes: "Imported from Square",
          created_at: si.created_at ?? now.toISOString(),
        })
        .select("id")
        .single();
      if (error || !created) { invoicesSkipped++; continue; }
      await db.from("invoice_line_items").insert({
        org_id: orgId,
        invoice_id: created.id,
        description: title,
        quantity: 1,
        unit_price: a.total,
        line_total: a.total,
        sort_order: 0,
      });
      invoicesCreated++;
    }

    const geo = await geocodeMissingCustomers(db, orgId, { budgetMs: geocodeBudgetMs });
    const summary: SquareSyncSummary = {
      customersCreated,
      customersLinked,
      invoicesCreated,
      invoicesUpdated,
      invoicesSkipped,
      mapped: geo.mapped,
    };
    await db
      .from("org_integrations")
      .update({ last_sync_at: now.toISOString(), last_sync_result: summary, sync_started_at: null, status: "connected", updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("provider", "square");
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .from("org_integrations")
      .update({ sync_started_at: null, last_sync_result: { error: message.slice(0, 300) }, updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("provider", "square");
    throw err;
  }
}

export async function maybeAutoSyncSquare(orgId: string): Promise<void> {
  if (!process.env.SQUARE_APPLICATION_ID) return;
  const db = createAdminClient();
  const { data: row } = await db
    .from("org_integrations")
    .select("last_sync_at")
    .eq("org_id", orgId)
    .eq("provider", "square")
    .maybeSingle();
  if (!row) return;
  const last = row.last_sync_at ? new Date(row.last_sync_at).getTime() : 0;
  if (Date.now() - last < AUTO_SYNC_EVERY_MS) return;
  try {
    await runSquareSync(orgId, { geocodeBudgetMs: 45_000 });
  } catch (err) {
    console.error("[square] auto-sync failed for org", orgId, err);
  }
}
