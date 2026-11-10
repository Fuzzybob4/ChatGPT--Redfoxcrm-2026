import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { phoneKey } from "@/lib/integrations/hubspot";

/**
 * Square OAuth + import (customers and invoices with their paid status).
 *
 * Env (Vercel): SQUARE_APPLICATION_ID, SQUARE_APPLICATION_SECRET,
 * optional SQUARE_ENVIRONMENT=sandbox for testing.
 * Redirect URL to register in the Square developer dashboard:
 *   https://www.redfoxcrm.com/api/integrations/square/callback
 */

export const SQUARE_STATE_COOKIE = "rf_square_oauth_state";
const SQUARE_VERSION = "2025-01-23";
export const SQUARE_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "CUSTOMERS_READ",
  "INVOICES_READ",
  "PAYMENTS_READ",
  "ORDERS_READ",
];

const isSandbox = () => (process.env.SQUARE_ENVIRONMENT || "").toLowerCase() === "sandbox";
const OAUTH_BASE = () => (isSandbox() ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com");
const API_BASE = () => (isSandbox() ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com");

// Trim in case a value was pasted with a space or line break.
const appId = () => (process.env.SQUARE_APPLICATION_ID || "").trim();
const appSecret = () => (process.env.SQUARE_APPLICATION_SECRET || "").trim();

/** Non-secret description of the configured credentials, for troubleshooting. */
export function squareCredentialShape(): string {
  const id = appId();
  const secret = appSecret();
  const kind = (v: string, prod: string, sandbox: string) =>
    v.startsWith(sandbox) ? "sandbox" : v.startsWith(prod) ? "production" : v.startsWith("EAAA") ? "access-token(wrong)" : "unknown";
  return `id=${kind(id, "sq0idp-", "sandbox-sq0idb-")} secret=${kind(secret, "sq0csp-", "sandbox-sq0csb-")} secretLen=${secret.length} rawHadWhitespace=${/\s/.test(process.env.SQUARE_APPLICATION_SECRET || "") || /\s/.test(process.env.SQUARE_APPLICATION_ID || "")} env=${isSandbox() ? "sandbox" : "production"}`;
}

export function squareConfigured(): boolean {
  return Boolean(appId() && appSecret());
}

export function squareRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/integrations/square/callback`;
}

export function squareAuthorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    scope: SQUARE_SCOPES.join(" "),
    session: "false",
    state,
    redirect_uri: squareRedirectUri(origin),
  });
  return `${OAUTH_BASE()}/oauth2/authorize?${params.toString()}`;
}

interface SquareToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  merchant_id: string;
}

async function tokenRequest(body: Record<string, string>): Promise<SquareToken> {
  const res = await fetch(`${OAUTH_BASE()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
    body: JSON.stringify({
      client_id: appId(),
      client_secret: appSecret(),
      ...body,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Square token request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as SquareToken;
}

export function exchangeSquareCode(code: string, origin: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: squareRedirectUri(origin) });
}

export async function revokeSquareToken(accessToken: string) {
  await fetch(`${OAUTH_BASE()}/oauth2/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
      Authorization: `Client ${appSecret()}`,
    },
    body: JSON.stringify({ client_id: appId(), access_token: accessToken }),
  }).catch(() => undefined);
}

export async function squareGet<T>(accessToken: string, path: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API_BASE()}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": SQUARE_VERSION },
      cache: "no-store",
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Square request ${path.split("?")[0]} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
  throw new Error("Square is rate limiting requests; try again shortly");
}

export async function squarePost<T>(accessToken: string, path: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API_BASE()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Square request ${path} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
  throw new Error("Square is rate limiting requests; try again shortly");
}

export interface SquareOrder {
  id: string;
  line_items?: Array<{
    name?: string;
    variation_name?: string;
    note?: string;
    quantity?: string;
    base_price_money?: { amount?: number };
    gross_sales_money?: { amount?: number };
    total_money?: { amount?: number };
  }>;
  discounts?: Array<{ name?: string; applied_money?: { amount?: number } }>;
}

/** Turns a Square order into Red Fox invoice line items (names, quantities, prices). */
export function orderToLineItems(order: SquareOrder): Array<{ description: string; quantity: number; unit_price: number; line_total: number }> {
  const items = (order.line_items ?? []).map((li) => {
    const variation = li.variation_name && !/^regular$/i.test(li.variation_name.trim()) ? li.variation_name.trim() : "";
    const name = [li.name?.trim() || "Item", variation].filter(Boolean).join(" – ");
    const description = [name.trim(), li.note?.trim()].filter(Boolean).join("\n").slice(0, 1000);
    const quantity = Number(li.quantity ?? 1) || 1;
    const unit = Number(li.base_price_money?.amount ?? 0) / 100;
    const total = Number(li.gross_sales_money?.amount ?? li.total_money?.amount ?? unit * 100 * quantity) / 100;
    return { description, quantity, unit_price: unit, line_total: total };
  });
  for (const d of order.discounts ?? []) {
    const amt = Number(d.applied_money?.amount ?? 0) / 100;
    if (amt > 0) items.push({ description: `Discount${d.name ? `: ${d.name}` : ""}`, quantity: 1, unit_price: -amt, line_total: -amt });
  }
  return items;
}

export async function getSquareMerchantName(accessToken: string, merchantId: string): Promise<string | null> {
  try {
    const data = await squareGet<{ merchant?: { business_name?: string } }>(accessToken, `/v2/merchants/${merchantId}`);
    return data.merchant?.business_name ?? null;
  } catch {
    return null;
  }
}

/** Valid access token for the org, refreshed when within 2 days of expiry. */
export async function getSquareAccessToken(orgId: string): Promise<string> {
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("org_integrations")
    .select("access_token, refresh_token, token_expires_at")
    .eq("org_id", orgId)
    .eq("provider", "square")
    .maybeSingle();
  if (error) throw error;
  if (!row?.refresh_token) throw new Error("Square is not connected");
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt - Date.now() > 2 * 24 * 60 * 60 * 1000) return row.access_token;

  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await db
    .from("org_integrations")
    .update({
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token || row.refresh_token,
      token_expires_at: fresh.expires_at,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("provider", "square");
  return fresh.access_token;
}

// ── Square → Red Fox mapping ──────────────────────────────────────────────────

export interface SquareCustomer {
  id: string;
  given_name?: string;
  family_name?: string;
  company_name?: string;
  email_address?: string;
  phone_number?: string;
  note?: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    administrative_district_level_1?: string;
    postal_code?: string;
  };
}

export function mapSquareCustomer(c: SquareCustomer) {
  const clean = (v?: string) => (v ?? "").replace(/\s+/g, " ").trim();
  const email = clean(c.email_address).toLowerCase();
  let first = clean(c.given_name);
  const last = clean(c.family_name);
  const company = clean(c.company_name);
  if (!first && !last) {
    if (company) first = company;
    else if (email) first = email.split("@")[0];
    else return null;
  }
  const street = [clean(c.address?.address_line_1), clean(c.address?.address_line_2)].filter(Boolean).join(" ");
  const firstName = first || "Unknown";
  const lastName = last || "Unknown";
  return {
    square_customer_id: c.id,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName === "Unknown" ? "" : lastName}`.trim(),
    email: email || null,
    phone: clean(c.phone_number) || null,
    address: street || null,
    city: clean(c.address?.locality) || null,
    state: clean(c.address?.administrative_district_level_1) || null,
    zip_code: clean(c.address?.postal_code) || null,
    notes: [company ? `Company: ${company}` : "", "Imported from Square"].filter(Boolean).join("; "),
    tags: ["square-import"],
    status: "active",
  };
}

export interface SquareInvoice {
  id: string;
  invoice_number?: string;
  title?: string;
  description?: string;
  status?: string;
  location_id?: string;
  created_at?: string;
  updated_at?: string;
  public_url?: string;
  order_id?: string;
  primary_recipient?: { customer_id?: string; email_address?: string; given_name?: string; family_name?: string };
  payment_requests?: Array<{
    request_type?: string;
    due_date?: string;
    computed_amount_money?: { amount?: number };
    total_completed_amount_money?: { amount?: number };
  }>;
}

export interface SquarePayment {
  id: string;
  status?: string;
  source_type?: string;
  created_at?: string;
  customer_id?: string;
  order_id?: string;
  note?: string;
  receipt_number?: string;
  receipt_url?: string;
  amount_money?: { amount?: number };
  refunded_money?: { amount?: number };
}

const SQUARE_STATUS: Record<string, string> = {
  DRAFT: "draft",
  UNPAID: "sent",
  SCHEDULED: "sent",
  PARTIALLY_PAID: "sent",
  PAYMENT_PENDING: "sent",
  PAID: "paid",
  PARTIALLY_REFUNDED: "paid",
  REFUNDED: "cancelled",
  CANCELED: "cancelled",
  FAILED: "sent",
};

export function mapSquareInvoiceAmounts(inv: SquareInvoice) {
  const reqs = inv.payment_requests ?? [];
  const total = reqs.reduce((s, r) => s + Number(r.computed_amount_money?.amount ?? 0), 0) / 100;
  const paid = reqs.reduce((s, r) => s + Number(r.total_completed_amount_money?.amount ?? 0), 0) / 100;
  const deposit = reqs
    .filter((r) => (r.request_type ?? "").toUpperCase() === "DEPOSIT")
    .reduce((s, r) => s + Number(r.computed_amount_money?.amount ?? 0), 0) / 100;
  const due = reqs
    .map((r) => r.due_date)
    .filter(Boolean)
    .sort()
    .pop() ?? null;
  const status = SQUARE_STATUS[(inv.status ?? "").toUpperCase()] ?? "sent";
  const paymentState = paid <= 0 ? "unpaid" : paid + 0.005 >= total ? "paid" : "partially_paid";
  return { total, paid, deposit, due, status, paymentState };
}

export { phoneKey };
