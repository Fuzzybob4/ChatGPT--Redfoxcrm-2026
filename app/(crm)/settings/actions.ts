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
