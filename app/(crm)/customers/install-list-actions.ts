"use server";

import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInstallItems, type InstallItem } from "@/lib/field";

/** This season's install list for a customer (same list the crew sees, no prices). */
export async function getCustomerInstallList(customerId: string): Promise<InstallItem[]> {
  const org = await getCurrentOrg();
  if (!org) return [];
  const { data: c } = await createAdminClient()
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!c) return [];
  return getInstallItems(org.orgId, customerId);
}
