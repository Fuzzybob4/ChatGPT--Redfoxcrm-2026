import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * HubSpot OAuth + contact import helpers.
 *
 * The OAuth app is registered in the Red Fox CRM HubSpot developer project
 * (projects platform, marketplace distribution). Redirect URLs registered there:
 *   https://redfoxcrm.com/api/integrations/hubspot/callback
 *   https://www.redfoxcrm.com/api/integrations/hubspot/callback
 *   http://localhost:3000/api/integrations/hubspot/callback
 *
 * Tokens are stored in public.org_integrations, which is service-role only.
 */

const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const API = "https://api.hubapi.com";

export const HUBSPOT_REQUIRED_SCOPES = ["oauth", "crm.objects.contacts.read"];
export const HUBSPOT_OPTIONAL_SCOPES = ["crm.objects.companies.read", "crm.objects.deals.read"];

export const HUBSPOT_STATE_COOKIE = "rf_hubspot_oauth_state";

const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobilephone",
  "address",
  "city",
  "state",
  "zip",
  "company",
  "lifecyclestage",
];

export function hubspotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET);
}

/** The callback URL must exactly match one registered in the HubSpot app. */
export function hubspotRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/integrations/hubspot/callback`;
}

export function hubspotAuthorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    redirect_uri: hubspotRedirectUri(origin),
    scope: HUBSPOT_REQUIRED_SCOPES.join(" "),
    optional_scope: HUBSPOT_OPTIONAL_SCOPES.join(" "),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      ...body,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HubSpot token request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeHubspotCode(code: string, origin: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    redirect_uri: hubspotRedirectUri(origin),
    code,
  });
}

export async function getHubspotTokenInfo(accessToken: string): Promise<{
  hubId: string | null;
  hubDomain: string | null;
  scopes: string[];
}> {
  const res = await fetch(`${API}/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`, {
    cache: "no-store",
  });
  if (!res.ok) return { hubId: null, hubDomain: null, scopes: [] };
  const data = (await res.json()) as { hub_id?: number; hub_domain?: string; scopes?: string[] };
  return {
    hubId: data.hub_id != null ? String(data.hub_id) : null,
    hubDomain: data.hub_domain ?? null,
    scopes: data.scopes ?? [],
  };
}

/** Returns a non-expired access token for the org, refreshing it if needed. */
export async function getHubspotAccessToken(orgId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("org_integrations")
    .select("access_token, refresh_token, token_expires_at")
    .eq("org_id", orgId)
    .eq("provider", "hubspot")
    .maybeSingle();
  if (error) throw error;
  if (!row?.refresh_token) throw new Error("HubSpot is not connected");

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt - Date.now() > 60_000) return row.access_token;

  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await admin
    .from("org_integrations")
    .update({
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token || row.refresh_token,
      token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("provider", "hubspot");
  return fresh.access_token;
}

export interface HubspotContact {
  id: string;
  properties: Record<string, string | null | undefined>;
}

/** Pages through every non-archived contact in the connected HubSpot account. */
export async function fetchAllHubspotContacts(accessToken: string): Promise<HubspotContact[]> {
  const all: HubspotContact[] = [];
  let after: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const params = new URLSearchParams({
      limit: "100",
      archived: "false",
      properties: CONTACT_PROPERTIES.join(","),
    });
    if (after) params.set("after", after);
    const res = await fetch(`${API}/crm/v3/objects/contacts?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      page--;
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HubSpot contacts request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      results: HubspotContact[];
      paging?: { next?: { after?: string } };
    };
    all.push(...(data.results ?? []));
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return all;
}

const ACTIVE_STAGES = new Set(["customer", "opportunity", "evangelist"]);

/** Maps a HubSpot contact to a Red Fox customer row (without org_id). Returns null if unusable. */
export function mapHubspotContact(contact: HubspotContact) {
  const p = contact.properties ?? {};
  const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

  let email = clean(p.email).toLowerCase();
  if (email.endsWith("@placeholder.com")) email = "";
  const phone = clean(p.phone) || clean(p.mobilephone);
  const company = clean(p.company);

  let first = clean(p.firstname);
  const last = clean(p.lastname);
  if (!first && !last) {
    if (email) first = email.split("@")[0];
    else if (company) first = company;
    else return null;
  }

  const stage = clean(p.lifecyclestage) || "none";
  const notes = [company ? `Company: ${company}` : "", `Imported from HubSpot (${stage})`]
    .filter(Boolean)
    .join("; ");

  const firstName = first || "Unknown";
  const lastName = last || "Unknown";
  return {
    hubspot_contact_id: contact.id,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName === "Unknown" ? "" : lastName}`.trim(),
    email: email || null,
    phone: phone || null,
    address: clean(p.address) || null,
    city: clean(p.city) || null,
    state: clean(p.state) || null,
    zip_code: clean(p.zip) || null,
    notes,
    tags: ["hubspot-import", `hs-${stage}`],
    status: ACTIVE_STAGES.has(stage) ? "active" : "lead",
  };
}

export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}
