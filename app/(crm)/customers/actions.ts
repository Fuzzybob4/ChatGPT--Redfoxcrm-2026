"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";
import { isManualStage } from "@/lib/lifecycle";

export interface CustomerCreateInput {
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
  locationId?: string;
}

export async function createCustomer(input: CustomerCreateInput) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  if (!input.name.trim()) throw new Error("Name is required.");

  let locationId = input.locationId || null;
  if (locationId) {
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .eq("org_id", org.orgId)
      .single();
    if (locationError || !location) throw new Error("Invalid location.");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      org_id: org.orgId,
      location_id: locationId,
      full_name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      zip_code: input.zip.trim(),
      status: input.status.toLowerCase(),
      notes: input.notes.trim(),
      tags: input.tags,
      marketing_opt_in: input.marketingOptIn,
      marketing_opt_in_at: input.marketingOptIn ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/customers");
  return data.id;
}

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

/**
 * Set (or clear) a manual lifecycle stage override. Passing `null` returns the
 * customer to automatic tracking driven by deposits and jobs.
 */
export async function updateCustomerStage(customerId: string, stage: string | null) {
  if (stage !== null && !isManualStage(stage)) {
    throw new Error("Invalid stage.");
  }

  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("customers")
    .update({ install_status: stage })
    .eq("id", customerId)
    .eq("org_id", org.orgId)
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Customer not found.");

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/mapping");
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

/**
 * Bulk delete from the Customers list. Customers with invoices or jobs are
 * kept (deleting them would orphan payment and job history) and reported
 * back so the team can mark them Cancelled instead. Deleted contacts that
 * came from HubSpot or Square are added to the never-import list so the
 * next sync doesn't bring them back.
 */
export async function deleteCustomers(
  customerIds: string[],
): Promise<{ deleted: number; kept: { id: string; name: string }[] }> {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  if (!["owner", "admin"].includes((org.role || "").toLowerCase())) {
    throw new Error("Only owners and admins can delete customers.");
  }
  const ids = [...new Set((customerIds ?? []).filter((id) => typeof id === "string"))].slice(0, 500);
  if (!ids.length) return { deleted: 0, kept: [] };

  const db = createAdminClient();
  const { data: rows } = await db
    .from("customers")
    .select("id, full_name, first_name, last_name, hubspot_contact_id, square_customer_id")
    .eq("org_id", org.orgId)
    .in("id", ids);
  const customers = (rows ?? []) as Array<Record<string, any>>;
  if (!customers.length) return { deleted: 0, kept: [] };

  const found = customers.map((c) => c.id as string);
  const [{ data: inv }, { data: jobs }] = await Promise.all([
    db.from("invoices").select("customer_id").eq("org_id", org.orgId).in("customer_id", found),
    db.from("scheduled_jobs").select("customer_id").eq("org_id", org.orgId).in("customer_id", found).neq("status", "cancelled"),
  ]);
  const hasHistory = new Set<string>([
    ...((inv ?? []) as Array<{ customer_id: string }>).map((r) => r.customer_id),
    ...((jobs ?? []) as Array<{ customer_id: string }>).map((r) => r.customer_id),
  ]);

  const nameOf = (c: Record<string, any>) => c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Customer";
  const kept = customers.filter((c) => hasHistory.has(c.id)).map((c) => ({ id: c.id as string, name: nameOf(c) }));
  const toDelete = customers.filter((c) => !hasHistory.has(c.id));
  if (!toDelete.length) return { deleted: 0, kept };

  const exclusions = toDelete.flatMap((c) => [
    ...(c.hubspot_contact_id ? [{ org_id: org.orgId, provider: "hubspot", external_id: String(c.hubspot_contact_id), reason: `Deleted in Red Fox: ${nameOf(c)}` }] : []),
    ...(c.square_customer_id ? [{ org_id: org.orgId, provider: "square", external_id: String(c.square_customer_id), reason: `Deleted in Red Fox: ${nameOf(c)}` }] : []),
  ]);
  if (exclusions.length) {
    await db.from("integration_import_exclusions").upsert(exclusions, { onConflict: "org_id,provider,external_id", ignoreDuplicates: true });
  }

  const { error } = await db.from("customers").delete().eq("org_id", org.orgId).in("id", toDelete.map((c) => c.id));
  if (error) throw new Error("Couldn't delete those customers.");

  revalidatePath("/customers");
  revalidatePath("/mapping");
  return { deleted: toDelete.length, kept };
}
