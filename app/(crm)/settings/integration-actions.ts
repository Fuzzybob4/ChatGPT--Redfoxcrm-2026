"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHubspotSync } from "@/lib/integrations/hubspot-sync";

export interface HubspotSyncResult {
  success: boolean;
  error?: string;
  total?: number;
  created?: number;
  linked?: number;
  skipped?: number;
  updated?: number;
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

/** "Sync now": full import of every HubSpot contact for the current org. */
export async function syncHubspotContacts(): Promise<HubspotSyncResult> {
  const { org, error: authError } = await requireManager();
  if (!org) return { success: false, error: authError };

  try {
    const result = await runHubspotSync(org.orgId, { mode: "full" });
    if (!result) {
      return { success: false, error: "A sync is already running in the background. Check back in a minute." };
    }
    revalidatePath("/customers");
    revalidatePath("/mapping");
    revalidatePath("/settings");
    return { success: true, ...result };
  } catch (err) {
    console.error("[hubspot] sync failed:", err);
    const message = err instanceof Error ? err.message : "";
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

export interface SquareSyncResult {
  success: boolean;
  error?: string;
  customersCreated?: number;
  customersLinked?: number;
  invoicesCreated?: number;
  invoicesUpdated?: number;
  invoicesSkipped?: number;
  paymentsImported?: number;
  itemsPulled?: number;
  mapped?: number;
}

/** "Sync now" for Square: customers + invoices (with paid status). */
export async function syncSquare(): Promise<SquareSyncResult> {
  const { org, error: authError } = await requireManager();
  if (!org) return { success: false, error: authError };
  try {
    const { runSquareSync } = await import("@/lib/integrations/square-sync");
    const result = await runSquareSync(org.orgId);
    if (!result) return { success: false, error: "A sync is already running in the background. Check back in a minute." };
    revalidatePath("/customers");
    revalidatePath("/invoices");
    revalidatePath("/settings");
    return { success: true, ...result };
  } catch (err) {
    console.error("[square] sync failed:", err);
    const message = err instanceof Error ? err.message : "";
    return {
      success: false,
      error: message.includes("not connected") ? "Square isn't connected yet." : "The Square import didn't finish. Please try again in a minute.",
    };
  }
}

export async function disconnectSquare(): Promise<{ success: boolean; error?: string }> {
  const { org, error: authError } = await requireManager();
  if (!org) return { success: false, error: authError };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("org_integrations")
    .select("access_token")
    .eq("org_id", org.orgId)
    .eq("provider", "square")
    .maybeSingle();
  if (row?.access_token) {
    const { revokeSquareToken } = await import("@/lib/integrations/square");
    await revokeSquareToken(row.access_token);
  }
  const { error } = await admin.from("org_integrations").delete().eq("org_id", org.orgId).eq("provider", "square");
  if (error) return { success: false, error: "Could not disconnect Square" };
  revalidatePath("/settings");
  return { success: true };
}
