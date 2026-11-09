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
  // HubSpot spreadsheet imports sometimes store numbers with a leading ' .
  const cleanPhone = (v: string | null | undefined) => clean(v).replace(/^'+/, "").trim();
  const phone = cleanPhone(p.phone) || cleanPhone(p.mobilephone);
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

/**
 * Looks up map coordinates for this org's customers that have a street address
 * but no lat/lng yet (e.g. right after a HubSpot import). Runs with limited
 * concurrency and stops before the time budget so the request can't time out;
 * anything left over is picked up by the next sync.
 */
export async function geocodeMissingCustomers(
  supabase: { from: (table: string) => any },
  orgId: string,
  { budgetMs = 200_000, concurrency = 8 }: { budgetMs?: number; concurrency?: number } = {},
): Promise<{ mapped: number; remaining: number }> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return { mapped: 0, remaining: 0 };
  const started = Date.now();

  // Default region for contacts whose address has no state: the business's own
  // state, else the state most of its customers are in. Results are also biased
  // toward the business's service area (center of its already-mapped customers).
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("city, state")
    .eq("org_id", orgId)
    .maybeSingle();
  type SampleRow = { state: string | null; lat: number | null; lng: number | null };
  const { data: sampleData } = await supabase
    .from("customers")
    .select("state, lat, lng")
    .eq("org_id", orgId)
    .not("state", "is", null)
    .limit(1000);
  const sample: SampleRow[] = (sampleData ?? []) as SampleRow[];
  const STATE_ALIASES: Record<string, string> = { TEXAS: "TX", TEX: "TX" };
  const stateCounts = new Map<string, number>();
  for (const r of sample) {
    const raw = String(r.state ?? "").trim().toUpperCase().replace(/[^A-Z ]/g, "");
    const st = STATE_ALIASES[raw] ?? (raw.length === 2 ? raw : "");
    if (st) stateCounts.set(st, (stateCounts.get(st) ?? 0) + 1);
  }
  const topState = [...stateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const fallbackState = String(profile?.state ?? "").trim() || topState;
  const fallbackRegion = [profile?.city, fallbackState].filter(Boolean).join(", ");
  const coords = sample.filter((r: SampleRow) => r.lat != null && r.lng != null);
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const proximity = coords.length >= 10
    ? `${median(coords.map((r: SampleRow) => Number(r.lng))).toFixed(4)},${median(coords.map((r: SampleRow) => Number(r.lat))).toFixed(4)}`
    : null;

  const targets: Array<{ id: string; address: string; city: string | null; state: string | null; zip_code: string | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, address, city, state, zip_code")
      .eq("org_id", orgId)
      .is("lat", null)
      .not("address", "is", null)
      .neq("address", "")
      .range(from, from + 999);
    if (error) throw error;
    targets.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  async function lookup(query: string) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=us&limit=1${proximity ? `&proximity=${proximity}` : ""}&access_token=${token}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.features?.[0]?.geometry?.coordinates;
    return Array.isArray(coords) ? { lng: coords[0] as number, lat: coords[1] as number } : null;
  }

  let index = 0;
  let mapped = 0;
  let attempted = 0;
  async function worker() {
    while (index < targets.length && Date.now() - started < budgetMs) {
      const t = targets[index++];
      attempted++;
      // Always include a state: the contact's own, or the business's default.
      const city = (t.city ?? "").trim();
      const zip = (t.zip_code ?? "").trim();
      const state = (t.state ?? "").trim() || fallbackState;
      const region = [city, state, zip].filter(Boolean).join(", ");
      const query = [t.address.trim(), region || fallbackRegion].filter(Boolean).join(", ");
      try {
        const hit = await lookup(query);
        if (hit) {
          await supabase.from("customers").update({ lat: hit.lat, lng: hit.lng }).eq("id", t.id).eq("org_id", orgId);
          mapped++;
        }
      } catch (err) {
        console.error("[geocode] failed for customer", t.id, err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
  return { mapped, remaining: Math.max(0, targets.length - attempted) };
}
