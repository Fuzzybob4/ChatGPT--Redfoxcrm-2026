"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

export interface CustomerUpdateInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  notes: string;
  tags: string[];
  marketingOptIn: boolean;
}

export async function updateCustomer(customerId: string, input: CustomerUpdateInput) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("customers")
    .update({
      full_name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: input.state,
      zip_code: input.zip,
      status: input.status.toLowerCase(),
      notes: input.notes,
      tags: input.tags,
      marketing_opt_in: input.marketingOptIn,
      marketing_opt_in_at: input.marketingOptIn ? new Date().toISOString() : null,
    })
    .eq("id", customerId)
    .eq("org_id", org.orgId);

  if (error) throw new Error(error.message);

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

export async function deleteCustomer(customerId: string) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("org_id", org.orgId);

  if (error) throw new Error(error.message);

  revalidatePath("/customers");
}

// ── Property (multi-address) actions ──────────────────────────────

export interface PropertyInput {
  propertyName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  isPrimary: boolean;
  isBillingAddress: boolean;
  isServiceAddress: boolean;
  notes: string;
}

export async function saveProperty(
  customerId: string,
  propertyId: string | null,
  input: PropertyInput,
) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const row = {
    property_name: input.propertyName || null,
    address: input.address,
    city: input.city || null,
    state: input.state || null,
    zip_code: input.zip || null,
    property_type: input.propertyType || null,
    is_primary: input.isPrimary,
    is_billing_address: input.isBillingAddress,
    is_service_address: input.isServiceAddress,
    notes: input.notes || null,
  };

  // Only one primary per customer: clear others if this one is primary.
  if (input.isPrimary) {
    await supabase
      .from("customer_properties")
      .update({ is_primary: false })
      .eq("customer_id", customerId)
      .eq("org_id", org.orgId);
  }

  if (propertyId) {
    const { error } = await supabase
      .from("customer_properties")
      .update(row)
      .eq("id", propertyId)
      .eq("org_id", org.orgId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("customer_properties").insert({
      ...row,
      customer_id: customerId,
      org_id: org.orgId,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/customers/${customerId}`);
}

export async function deleteProperty(customerId: string, propertyId: string) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("customer_properties")
    .delete()
    .eq("id", propertyId)
    .eq("org_id", org.orgId);

  if (error) throw new Error(error.message);

  revalidatePath(`/customers/${customerId}`);
}

export async function setPropertyManager(
  customerId: string,
  isPropertyManager: boolean,
  company: string,
) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("customers")
    .update({
      is_property_manager: isPropertyManager,
      property_manager_company: company || null,
    })
    .eq("id", customerId)
    .eq("org_id", org.orgId);

  if (error) throw new Error(error.message);

  revalidatePath(`/customers/${customerId}`);
}
