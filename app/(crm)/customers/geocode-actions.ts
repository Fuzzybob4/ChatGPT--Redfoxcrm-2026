"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { geocodePropertyAddress } from "@/lib/geocoding";

type GeocodeOutcome = { ok: true; located: boolean } | { ok: false; error: string };
type CoordNames = "short" | "long";

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

function coordPatch(names: CoordNames, lat: number | null, lng: number | null) {
  return names === "short" ? { lat, lng } : { latitude: lat, longitude: lng };
}

/**
 * Geocode a customer's street address with Mapbox and store customers.lat/lng
 * (the same columns the CSV import and /mapping use).
 *
 * Never throws: geocoding is best-effort and must not fail or block a save.
 * Callers fire it after the customer row is already written.
 */
export async function geocodeCustomer(
  customerId: string,
  options: { force?: boolean } = {},
): Promise<GeocodeOutcome> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };

    // CSV import and /mapping use lat/lng. Some rows may use latitude/longitude
    // instead; a missing short name falls back to the long one.
    const short = await supabase
      .from("customers")
      .select("id, address, city, state, zip_code, lat, lng")
      .eq("id", customerId)
      .eq("org_id", org.orgId)
      .maybeSingle();
    let names: CoordNames = "short";
    let c = short.data;
    let error = short.error;
    if (error && isMissingColumn(error)) {
      const long = await supabase
        .from("customers")
        .select("id, address, city, state, zip_code, latitude, longitude")
        .eq("id", customerId)
        .eq("org_id", org.orgId)
        .maybeSingle();
      names = "long";
      error = long.error;
      c = long.data
        ? { ...long.data, lat: long.data.latitude, lng: long.data.longitude }
        : null;
    }
    if (error || !c) return { ok: false, error: error?.message ?? "Customer not found" };
    if (!options.force && c.lat != null && c.lng != null) return { ok: true, located: true };

    // No street address → no pin (a city-centroid pin is misleading), and
    // clear any stale coordinates left from a previous address.
    if (!String(c.address ?? "").trim()) {
      if (c.lat != null || c.lng != null) {
        await supabase.from("customers").update(coordPatch(names, null, null)).eq("id", c.id).eq("org_id", org.orgId);
      }
      return { ok: true, located: false };
    }

    const result = await geocodePropertyAddress(c.address ?? "", c.city ?? "", c.state ?? "", c.zip_code ?? "", {
      allowCityFallback: false,
    });
    if (!result) return { ok: true, located: false };

    let { error: updateError } = await supabase
      .from("customers")
      .update(coordPatch(names, result.lat, result.lng))
      .eq("id", c.id)
      .eq("org_id", org.orgId);
    if (updateError && names === "short" && isMissingColumn(updateError)) {
      const retry = await supabase
        .from("customers")
        .update(coordPatch("long", result.lat, result.lng))
        .eq("id", c.id)
        .eq("org_id", org.orgId);
      updateError = retry.error;
    }
    if (updateError) {
      console.error("[geocodeCustomer] could not store coordinates", updateError);
      return { ok: false, error: updateError.message };
    }

    revalidatePath("/mapping");
    return { ok: true, located: true };
  } catch (e) {
    console.error("[geocodeCustomer] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Geocoding failed" };
  }
}

/**
 * Backfill: geocode customers that have a street address but no coordinates
 * (e.g. created before geocode-on-save existed). Bounded per call.
 */
export async function geocodeMissingCustomers(limit = 25): Promise<{ located: number; attempted: number }> {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) return { located: 0, attempted: 0 };

  const cap = Math.min(Math.max(limit, 1), 50);
  const short = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", org.orgId)
    .is("lat", null)
    .not("address", "is", null)
    .neq("address", "")
    .limit(cap);
  let rows = short.data;
  if (short.error && isMissingColumn(short.error)) {
    const long = await supabase
      .from("customers")
      .select("id")
      .eq("org_id", org.orgId)
      .is("latitude", null)
      .not("address", "is", null)
      .neq("address", "")
      .limit(cap);
    rows = long.data;
  }

  let located = 0;
  for (const row of rows ?? []) {
    const r = await geocodeCustomer(row.id as string);
    if (r.ok && r.located) located += 1;
  }
  revalidatePath("/mapping");
  return { located, attempted: rows?.length ?? 0 };
}
