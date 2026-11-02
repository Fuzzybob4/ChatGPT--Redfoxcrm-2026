"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { geocodePropertyAddress } from "@/lib/geocoding";
import { geocodeCustomer } from "./geocode-actions";

function isMissingColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const text = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /schema cache/i.test(text) ||
    /could not find the/i.test(text) ||
    /does not exist/i.test(text)
  );
}

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

export type CreateCustomerResult = { ok: true; id: string } | { ok: false; error: string };

// Returns errors instead of throwing: Next.js replaces thrown server-action
// messages in production with "An error occurred in the Server Components
// render", which hides the real cause from the user.
export async function createCustomer(input: CustomerCreateInput): Promise<CreateCustomerResult> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };
    const fullName = input.name.trim();
    if (!fullName) return { ok: false, error: "Name is required." };

    const locationId = input.locationId || null;
    if (locationId) {
      const { data: location, error: locationError } = await supabase
        .from("locations")
        .select("id")
        .eq("id", locationId)
        .eq("org_id", org.orgId)
        .maybeSingle();
      if (locationError || !location) return { ok: false, error: "Invalid location." };
    }

    // Mirror the customer import insert (import-actions.ts), which works in
    // production: always set first_name/last_name and use null, not "", for
    // empty optional fields.
    const [firstName, ...rest] = fullName.split(/\s+/);
    const blankToNull = (value: string) => value.trim() || null;

    const { data, error } = await supabase
      .from("customers")
      .insert({
        org_id: org.orgId,
        location_id: locationId,
        first_name: firstName,
        last_name: rest.join(" "),
        full_name: fullName,
        email: blankToNull(input.email),
        phone: blankToNull(input.phone),
        address: blankToNull(input.address),
        city: blankToNull(input.city),
        state: blankToNull(input.state),
        zip_code: blankToNull(input.zip),
        status: input.status.toLowerCase() || "active",
        notes: blankToNull(input.notes),
        tags: input.tags,
        marketing_opt_in: input.marketingOptIn,
        marketing_opt_in_at: input.marketingOptIn ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[createCustomer] insert failed", {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      return { ok: false, error: error?.message ?? "Unable to create customer." };
    }

    revalidatePath("/customers");
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[createCustomer] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unable to create customer." };
  }
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

  // Re-geocode after the save has committed. geocodeCustomer never throws, so
  // a Mapbox outage can't fail the update.
  await geocodeCustomer(customerId, { force: true });

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
  /** Optional coordinates from the form's "Geocode Address" button. */
  lat?: number | null;
  lng?: number | null;
}

export async function saveProperty(
  customerId: string,
  propertyId: string | null,
  input: PropertyInput,
) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  // Persist coordinates (previously the form's geocode result was dropped).
  // Use the form's values if it already geocoded, otherwise try Mapbox here.
  // A failed lookup omits lat/lng so an existing pin is not wiped, and a
  // missing column does not fail the address save.
  let lat = typeof input.lat === "number" ? input.lat : null;
  let lng = typeof input.lng === "number" ? input.lng : null;
  if ((lat == null || lng == null) && input.address.trim()) {
    try {
      const geo = await geocodePropertyAddress(input.address, input.city, input.state, input.zip, {
        allowCityFallback: false,
      });
      if (geo) ({ lat, lng } = geo);
    } catch (e) {
      console.error("[saveProperty] geocode failed", e);
    }
  }

  const row: Record<string, unknown> = {
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
  if (typeof lat === "number" && typeof lng === "number") {
    row.lat = lat;
    row.lng = lng;
  }

  // Only one primary per customer: clear others if this one is primary.
  if (input.isPrimary) {
    await supabase
      .from("customer_properties")
      .update({ is_primary: false })
      .eq("customer_id", customerId)
      .eq("org_id", org.orgId);
  }

  const payload = propertyId
    ? row
    : { ...row, customer_id: customerId, org_id: org.orgId };
  const write = (body: Record<string, unknown>) =>
    propertyId
      ? supabase.from("customer_properties").update(body).eq("id", propertyId).eq("org_id", org.orgId)
      : supabase.from("customer_properties").insert(body);

  const { error } = await write(payload);
  if (error && isMissingColumn(error) && ("lat" in payload || "lng" in payload)) {
    console.error("[saveProperty] lat/lng rejected, saving without coordinates", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const rest = { ...payload };
    delete rest.lat;
    delete rest.lng;
    const retry = await write(rest);
    if (retry.error) throw new Error(retry.error.message);
  } else if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/mapping");
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
