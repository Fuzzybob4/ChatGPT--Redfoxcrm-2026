"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export interface BusinessProfileInput {
  businessName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export async function saveBusinessProfile(input: BusinessProfileInput) {
  const org = await getCurrentOrg();
  if (!org) return { success: false, error: "Not authenticated" };

  const businessName = input.businessName.trim();
  if (!businessName) return { success: false, error: "Business name is required" };

  const supabase = await createClient();
  const profile = {
    org_id: org.orgId,
    business_name: businessName,
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    website: input.website.trim() || null,
    address: input.address.trim() || null,
    city: input.city.trim() || null,
    state: input.state.trim() || null,
    zip_code: input.zipCode.trim() || null,
  };

  const { error } = await supabase
    .from("business_profiles")
    .upsert(profile, { onConflict: "org_id" });

  if (error) return { success: false, error: error.message };

  await supabase
    .from("organizations")
    .update({ name: businessName })
    .eq("id", org.orgId);

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Turns automatic payment reminder emails on or off for the business. */
export async function setInvoiceRemindersEnabled(enabled: boolean) {
  const org = await getCurrentOrg();
  if (!org) return { success: false, error: "Not authenticated" };
  if (!["owner", "admin"].includes((org.role || "").toLowerCase())) {
    return { success: false, error: "Only owners and admins can change this" };
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await createAdminClient()
    .from("organizations")
    .update({ invoice_reminders_enabled: Boolean(enabled) })
    .eq("id", org.orgId);
  if (error) return { success: false, error: "Could not save" };
  revalidatePath("/settings");
  return { success: true };
}
