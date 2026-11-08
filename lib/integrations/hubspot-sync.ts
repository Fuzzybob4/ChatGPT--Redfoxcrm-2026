import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAllHubspotContacts,
  geocodeMissingCustomers,
  getHubspotAccessToken,
  mapHubspotContact,
  phoneKey,
  type HubspotContact,
} from "@/lib/integrations/hubspot";

export interface HubspotSyncSummary {
  total: number;
  created: number;
  linked: number;
  updated: number;
  skipped: number;
  mapped: number;
  mapRemaining: number;
}

const LOCK_MS = 10 * 60 * 1000;
const AUTO_SYNC_EVERY_MS = 10 * 60 * 1000;

const CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "phone", "mobilephone",
  "address", "city", "state", "zip", "company", "lifecyclestage",
];

/** Contacts created or changed in HubSpot since `sinceIso` (search API, max 10k). */
async function fetchChangedHubspotContacts(accessToken: string, sinceIso: string): Promise<HubspotContact[]> {
  const all: HubspotContact[] = [];
  let after: string | undefined;
  const since = String(new Date(sinceIso).getTime());
  for (let page = 0; page < 100; page++) {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "lastmodifieddate", operator: "GTE", value: since }] }],
        sorts: [{ propertyName: "lastmodifieddate", direction: "ASCENDING" }],
        properties: CONTACT_PROPERTIES,
        limit: 100,
        ...(after ? { after } : {}),
      }),
      cache: "no-store",
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      page--;
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HubSpot search failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { results: HubspotContact[]; paging?: { next?: { after?: string } } };
    all.push(...(data.results ?? []));
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return all;
}

/**
 * Imports HubSpot contacts for one org. Runs with the service-role client, so
 * every query below is explicitly scoped to `orgId`.
 *
 * - full: every contact (first import, "Sync now")
 * - incremental: only contacts created/changed since the last sync (automatic)
 *
 * Existing Red Fox customers are never overwritten: matches are linked, and
 * previously imported contacts only get blank fields (e.g. a new address) filled in.
 * Returns null if another sync for this org is already running.
 */
export async function runHubspotSync(
  orgId: string,
  { mode, geocodeBudgetMs }: { mode: "full" | "incremental"; geocodeBudgetMs?: number },
): Promise<HubspotSyncSummary | null> {
  const db = createAdminClient();

  // Claim a lock so page loads, the nightly job and "Sync now" can't overlap.
  const now = new Date();
  const { data: claimed, error: claimError } = await db
    .from("org_integrations")
    .update({ sync_started_at: now.toISOString() })
    .eq("org_id", orgId)
    .eq("provider", "hubspot")
    .or(`sync_started_at.is.null,sync_started_at.lt.${new Date(now.getTime() - LOCK_MS).toISOString()}`)
    .select("last_sync_at")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return null;

  try {
    const token = await getHubspotAccessToken(orgId);
    const lastSync = claimed.last_sync_at as string | null;
    const contacts =
      mode === "incremental" && lastSync
        ? await fetchChangedHubspotContacts(token, new Date(new Date(lastSync).getTime() - 10 * 60 * 1000).toISOString())
        : await fetchAllHubspotContacts(token);

    const existing: Array<Record<string, any>> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("customers")
        .select("id, email, phone, address, city, state, zip_code, hubspot_contact_id")
        .eq("org_id", orgId)
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      existing.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    // Contacts the business deleted on purpose are never re-imported.
    const { data: exclusions } = await db
      .from("integration_import_exclusions")
      .select("external_id")
      .eq("org_id", orgId)
      .eq("provider", "hubspot");
    const excluded = new Set((exclusions ?? []).map((e) => e.external_id as string));

    const byHubspotId = new Map<string, Record<string, any>>();
    const byEmail = new Map<string, Record<string, any>>();
    const byPhone = new Map<string, Record<string, any>>();
    for (const c of existing) {
      if (c.hubspot_contact_id) byHubspotId.set(c.hubspot_contact_id, c);
      if (c.email) byEmail.set(String(c.email).toLowerCase(), c);
      const pk = phoneKey(c.phone);
      if (pk) byPhone.set(pk, c);
    }

    const toInsert: Array<Record<string, any>> = [];
    const updates: Array<{ id: string; changes: Record<string, any> }> = [];
    const seenEmail = new Set<string>();
    const seenPhone = new Set<string>();
    let skipped = 0;
    let linked = 0;

    for (const contact of contacts) {
      if (excluded.has(contact.id)) { skipped++; continue; }
      const row = mapHubspotContact(contact);
      if (!row) { skipped++; continue; }

      // Already imported: only fill in fields that are blank in Red Fox.
      const known = byHubspotId.get(contact.id);
      if (known) {
        const changes: Record<string, any> = {};
        for (const field of ["email", "phone", "address", "city", "state", "zip_code"] as const) {
          if (!String(known[field] ?? "").trim() && row[field]) changes[field] = row[field];
        }
        if (Object.keys(changes).length) {
          if (changes.address) { changes.lat = null; changes.lng = null; }
          updates.push({ id: known.id, changes });
        } else skipped++;
        continue;
      }

      const pk = phoneKey(row.phone);
      const match = (row.email && byEmail.get(row.email)) || (pk && byPhone.get(pk)) || null;
      if (match) {
        if (!match.hubspot_contact_id) {
          updates.push({ id: match.id, changes: { hubspot_contact_id: contact.id } });
          match.hubspot_contact_id = contact.id;
          linked++;
        } else skipped++;
        continue;
      }
      if ((row.email && seenEmail.has(row.email)) || (pk && seenPhone.has(pk))) { skipped++; continue; }
      if (row.email) seenEmail.add(row.email);
      if (pk) seenPhone.add(pk);
      toInsert.push({ ...row, org_id: orgId });
    }

    let created = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { error } = await db.from("customers").insert(chunk);
      if (error) throw error;
      created += chunk.length;
    }

    let updated = 0;
    for (const u of updates) {
      const { error } = await db.from("customers").update(u.changes).eq("id", u.id).eq("org_id", orgId);
      if (!error && !("hubspot_contact_id" in u.changes)) updated++;
    }

    const geo = await geocodeMissingCustomers(db, orgId, { budgetMs: geocodeBudgetMs ?? 200_000 });

    const summary: HubspotSyncSummary = {
      total: contacts.length,
      created,
      linked,
      updated,
      skipped,
      mapped: geo.mapped,
      mapRemaining: geo.remaining,
    };
    await db
      .from("org_integrations")
      .update({
        last_sync_at: now.toISOString(),
        last_sync_result: { ...summary, mode },
        status: "connected",
        sync_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", "hubspot");
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .from("org_integrations")
      .update({ sync_started_at: null, last_sync_result: { error: message.slice(0, 300) }, updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("provider", "hubspot");
    throw err;
  }
}

/** Called on CRM page loads: runs a quick incremental sync if the last one is stale. */
export async function maybeAutoSyncHubspot(orgId: string): Promise<void> {
  if (!process.env.HUBSPOT_CLIENT_ID) return;
  const db = createAdminClient();
  const { data: row } = await db
    .from("org_integrations")
    .select("last_sync_at, sync_started_at")
    .eq("org_id", orgId)
    .eq("provider", "hubspot")
    .maybeSingle();
  if (!row) return;
  const last = row.last_sync_at ? new Date(row.last_sync_at).getTime() : 0;
  if (Date.now() - last < AUTO_SYNC_EVERY_MS) return;
  try {
    await runHubspotSync(orgId, { mode: "incremental", geocodeBudgetMs: 60_000 });
  } catch (err) {
    console.error("[hubspot] auto-sync failed for org", orgId, err);
  }
}
