"use server";

import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { OFFICE_ROLES, getCustomInstallItems, getInvoiceInstallItems, type InstallItem } from "@/lib/field";

export interface InstallListView {
  items: InstallItem[];
  /** True when the office edited this list by hand (it no longer follows the invoice). */
  custom: boolean;
  canEdit: boolean;
}

async function context(customerId: string) {
  const org = await getCurrentOrg();
  if (!org) return null;
  const db = createAdminClient();
  const { data: c } = await db.from("customers").select("id").eq("id", customerId).eq("org_id", org.orgId).maybeSingle();
  if (!c) return null;
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const rules = await loadBusinessRules(db, org.orgId);
  return { org, db, season: rules.seasonStart };
}

/** This season's install list for a customer (office view, no prices). */
export async function getCustomerInstallList(customerId: string): Promise<InstallListView> {
  const ctx = await context(customerId);
  if (!ctx) return { items: [], custom: false, canEdit: false };
  const canEdit = OFFICE_ROLES.includes(String(ctx.org.role ?? "").toLowerCase());
  const custom = await getCustomInstallItems(ctx.org.orgId, customerId, ctx.season);
  if (custom) return { items: custom, custom: true, canEdit };
  return { items: await getInvoiceInstallItems(ctx.org.orgId, customerId, ctx.season), custom: false, canEdit };
}

/**
 * Save a hand-edited list for this season. Pass null to go back to the list
 * from the estimate/invoice. Never changes the invoice or Square.
 */
export async function saveCustomerInstallList(
  customerId: string,
  items: InstallItem[] | null,
): Promise<{ ok: true; view: InstallListView } | { ok: false; error: string }> {
  const ctx = await context(customerId);
  if (!ctx) return { ok: false, error: "Customer not found." };
  if (!OFFICE_ROLES.includes(String(ctx.org.role ?? "").toLowerCase())) {
    return { ok: false, error: "Only owners, admins and managers can edit the install list." };
  }
  const clean =
    items === null
      ? null
      : items
          .slice(0, 100)
          .map((i) => ({
            description: String(i.description ?? "").replace(/\r/g, "").trim().slice(0, 2000),
            quantity: Number(i.quantity) > 0 ? Math.round(Number(i.quantity) * 100) / 100 : 1,
          }))
          .filter((i) => i.description);
  const { error } = await ctx.db
    .from("customers")
    .update({
      install_items: clean,
      install_items_season: clean ? ctx.season.slice(0, 10) : null,
      install_items_updated_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .eq("org_id", ctx.org.orgId);
  if (error) return { ok: false, error: "Couldn't save the list. Try again." };
  return { ok: true, view: await getCustomerInstallList(customerId) };
}
