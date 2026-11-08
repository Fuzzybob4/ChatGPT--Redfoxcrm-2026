"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAllHubspotContacts,
  geocodeMissingCustomers,
  getHubspotAccessToken,
  mapHubspotContact,
  phoneKey,
} from "@/lib/integrations/hubspot";

export interface HubspotSyncResult {
  success: boolean;
  error?: string;
  total?: number;
  created?: number;
  linked?: number;
  skipped?: number;
  mapped?: number;
  mapRemaining?: number;
}

async function requireManager() {
  const org = await getCurrentOrg();
  if (!org) return { org: null, error: "Not signed in" } as const;
  if (!["owner", "admin"].includes((org.role || "").toLowerCase())) {
    return { org: null, error: "Only owners and admins can manage integrations" } as const;
  }
  return { org, error: null } as const;
}

/**
 * Imports every HubSpot contact into the current org's customers.
 * - Contacts already imported (same hubspot_contact_id) are skipped.
 * - Contacts matching an existing customer by email or phone are linked, not
 *   overwritten, so real customer records keep their status and details.
 * - Everyone else is created. Customers/opportunities -> "active", others -> "lead".
 */
export async function syncHubspotContacts(): Promise<HubspotSyncResult> {
  const { org, error: authError } = await requireManager();
  if (!org) return { success: false, error: authError };

  const admin = createAdminClient();
  const supabase = await createClient();

  try {
    const token = await getHubspotAccessToken(org.orgId);
    const contacts = await fetchAllHubspotContacts(token);

    // Load existing customers (paged; PostgREST caps responses at 1000 rows).
    const existing: Array<{ id: string; email: string | null; phone: string | null; hubspot_contact_id: string | null }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, email, phone, hubspot_contact_id")
        .eq("org_id", org.orgId)
        .range(from, from + 999);
      if (error) throw error;
      existing.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const knownHubspotIds = new Set(existing.map((c) => c.hubspot_contact_id).filter(Boolean) as string[]);
    const byEmail = new Map<string, { id: string; linked: boolean }>();
    const byPhone = new Map<string, { id: string; linked: boolean }>();
    for (const c of existing) {
      const entry = { id: c.id, linked: Boolean(c.hubspot_contact_id) };
      if (c.email) byEmail.set(c.email.toLowerCase(), entry);
      const pk = phoneKey(c.phone);
      if (pk) byPhone.set(pk, entry);
    }

    const toInsert: Array<NonNullable<ReturnType<typeof mapHubspotContact>> & { org_id: string }> = [];
    const toLink: Array<{ id: string; hubspotId: string }> = [];
    const seenEmail = new Set<string>();
    const seenPhone = new Set<string>();
    let skipped = 0;

    for (const contact of contacts) {
      if (knownHubspotIds.has(contact.id)) { skipped++; continue; }
      const row = mapHubspotContact(contact);
      if (!row) { skipped++; continue; }

      const pk = phoneKey(row.phone);
      const match = (row.email && byEmail.get(row.email)) || (pk && byPhone.get(pk)) || null;
      if (match) {
        if (!match.linked) {
          toLink.push({ id: match.id, hubspotId: contact.id });
          match.linked = true;
        } else {
          skipped++;
        }
        continue;
      }
      // Duplicates inside HubSpot itself (same email or phone twice).
      if ((row.email && seenEmail.has(row.email)) || (pk && seenPhone.has(pk))) { skipped++; continue; }
      if (row.email) seenEmail.add(row.email);
      if (pk) seenPhone.add(pk);

      toInsert.push({ ...row, org_id: org.orgId });
    }

    let created = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { error } = await supabase.from("customers").insert(chunk);
      if (error) throw error;
      created += chunk.length;
    }

    let linked = 0;
    for (const link of toLink) {
      const { error } = await supabase
        .from("customers")
        .update({ hubspot_contact_id: link.hubspotId })
        .eq("id", link.id)
        .eq("org_id", org.orgId)
        .is("hubspot_contact_id", null);
      if (!error) linked++;
    }

    // Put imported customers on the map (address -> coordinates).
    const geo = await geocodeMissingCustomers(supabase, org.orgId);

    const result = { total: contacts.length, created, linked, skipped, mapped: geo.mapped, mapRemaining: geo.remaining };
    await admin
      .from("org_integrations")
      .update({ last_sync_at: new Date().toISOString(), last_sync_result: result, status: "connected", updated_at: new Date().toISOString() })
      .eq("org_id", org.orgId)
      .eq("provider", "hubspot");

    revalidatePath("/customers");
    revalidatePath("/settings");
    return { success: true, ...result };
  } catch (err) {
    console.error("[hubspot] sync failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await admin
      .from("org_integrations")
      .update({ last_sync_result: { error: message.slice(0, 300) }, updated_at: new Date().toISOString() })
      .eq("org_id", org.orgId)
      .eq("provider", "hubspot");
    return {
      success: false,
      error: message.includes("not connected")
        ? "HubSpot isn't connected yet."
        : "The HubSpot import didn't finish. Please try again in a minute.",
    };
  }
}

export async function disconnectHubspot(): Promise<{ success: boolean; error?: string }> {
  const { org, error: authError } = await requireManager();
  if (!org) return { success: false, error: authError };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("org_integrations")
    .select("refresh_token")
    .eq("org_id", org.orgId)
    .eq("provider", "hubspot")
    .maybeSingle();

  // Best effort: revoke the refresh token on HubSpot's side too.
  if (row?.refresh_token) {
    await fetch(`https://api.hubapi.com/oauth/v1/refresh-tokens/${encodeURIComponent(row.refresh_token)}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  const { error } = await admin
    .from("org_integrations")
    .delete()
    .eq("org_id", org.orgId)
    .eq("provider", "hubspot");
  if (error) return { success: false, error: "Could not disconnect HubSpot" };

  revalidatePath("/settings");
  return { success: true };
}
