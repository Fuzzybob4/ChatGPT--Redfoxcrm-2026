"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { geocodePropertyAddress } from "@/lib/geocoding";
import { revalidatePath } from "next/cache";
import { normalizeCSVHeader, parseCSV } from "@/lib/csv";

/**
 * Runs async geocode+update jobs with limited concurrency so we don't
 * hammer the Mapbox API (or time out the server action) on large CSVs.
 */
async function geocodeCustomersWithLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targets: Array<{ id: string; address: string; city?: string; state?: string; zip_code?: string }>,
  concurrency = 5
) {
  let index = 0;
  async function worker() {
    while (index < targets.length) {
      const target = targets[index++];
      try {
        const result = await geocodePropertyAddress(
          target.address,
          target.city ?? "",
          target.state ?? "",
          target.zip_code ?? ""
        );
        if (result) {
          await supabase
            .from("customers")
            .update({ lat: result.lat, lng: result.lng })
            .eq("id", target.id);
        }
      } catch (err) {
        console.error("[v0] Failed to geocode imported customer:", target.id, err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
}

export interface CustomerImportRow {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  locationId?: string;
}

export async function importCustomersFromCSV(
  csvText: string,
  locationId: string
): Promise<{
  success: boolean;
  imported: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}> {
  try {
    const org = await getCurrentOrg();
    if (!org) return { success: false, imported: 0, created: 0, updated: 0, failed: 0, errors: [{ row: 0, error: "Organization not found" }] };

    const supabase = await createClient();

    const parsed = parseCSV(csvText);
    if (parsed.length < 2) {
      return { success: false, imported: 0, created: 0, updated: 0, failed: 0, errors: [{ row: 0, error: "CSV must have header and at least one data row" }] };
    }

    const headers = parsed[0].map(normalizeCSVHeader);
    
    // Support multiple column name variations
    const findHeader = (names: string[]) => headers.findIndex((h) => names.includes(h));
    
    const firstNameIdx = findHeader(["first name", "firstname", "given name"]);
    const lastNameIdx = findHeader(["last name", "lastname", "surname", "family name"]);
    const nameIdx = findHeader(["name", "full name", "customer name", "client name"]);
    const emailIdx = findHeader(["email", "email address", "customer email", "client email"]);
    const phoneIdx = findHeader(["phone", "phone number", "mobile", "mobile phone", "customer phone", "client phone"]);
    const addressIdx = findHeader(["address", "street address", "street", "address 1", "service address"]);
    const cityIdx = findHeader(["city"]);
    const stateIdx = findHeader(["state", "province", "region"]);
    const zipIdx = findHeader(["zip", "zip code", "zipcode", "postal code"]);
    const notesIdx = findHeader(["notes", "note", "customer notes", "client notes"]);
    const tagsIdx = findHeader(["tags", "tag", "labels"]);
    const statusIdx = findHeader(["status", "customer status", "client status"]);

    // Check if we have a name field or first/last name
    if (nameIdx === -1 && (firstNameIdx === -1 || lastNameIdx === -1)) {
      return {
        success: false,
        imported: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: [{ row: 0, error: 'CSV must have either "name" or "first name"/"last name" columns' }],
      };
    }

    const rows: Array<{
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      notes?: string;
      tags?: string[];
      status?: string;
      location_id?: string;
    }> = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 1; i < parsed.length; i++) {
      const values = parsed[i];
      
      // Build first and last names from CSV columns
      let firstName = firstNameIdx !== -1 ? values[firstNameIdx] : "";
      let lastName = lastNameIdx !== -1 ? values[lastNameIdx] : "";
      
      // Fallback: if no first/last names, try to split the "name" column
      if ((!firstName || !lastName) && nameIdx !== -1) {
        const fullName = values[nameIdx] || "";
        const parts = fullName.split(" ");
        if (parts.length >= 2) {
          firstName = firstName || parts[0];
          lastName = lastName || parts.slice(1).join(" ");
        } else {
          firstName = firstName || fullName;
          lastName = lastName || "";
        }
      }

      firstName = firstName.trim();
      lastName = lastName.trim();

      if (!firstName && !lastName) {
        errors.push({ row: i + 1, error: "First name or last name is required" });
        continue;
      }

      rows.push({
        first_name: firstName || "Unknown",
        last_name: lastName || "Unknown",
        email: values[emailIdx] || undefined,
        phone: values[phoneIdx] || undefined,
        address: values[addressIdx] || undefined,
        city: values[cityIdx] || undefined,
        state: values[stateIdx] || undefined,
        zip_code: values[zipIdx] || undefined,
        notes: values[notesIdx] || undefined,
        tags: values[tagsIdx]
          ? values[tagsIdx].split(/[;|]/).map((tag) => tag.trim()).filter(Boolean)
          : undefined,
        status: values[statusIdx]?.toLowerCase() || "active",
        location_id: locationId || undefined,
      });
    }

    if (rows.length === 0) {
      return {
        success: false,
        imported: 0,
        created: 0,
        updated: 0,
        failed: errors.length,
        errors,
      };
    }

    const customers = rows.map((row) => ({
      org_id: org.orgId,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email || null,
      phone: row.phone || null,
      address: row.address || null,
      city: row.city || null,
      state: row.state || null,
      zip_code: row.zip_code || null,
      full_name: `${row.first_name} ${row.last_name}`.trim(),
      notes: row.notes || null,
      tags: row.tags || [],
      status: row.status || "active",
    }));

    const { data: existing, error: existingError } = await supabase
      .from("customers")
      .select("id, email, phone")
      .eq("org_id", org.orgId);
    if (existingError) throw existingError;

    const byEmail = new Map((existing ?? []).filter((c) => c.email).map((c) => [c.email.toLowerCase(), c.id]));
    const byPhone = new Map((existing ?? []).filter((c) => c.phone).map((c) => [c.phone.replace(/\D/g, ""), c.id]));
    const inserts: typeof customers = [];
    const updateTargets: Array<{
      id: string;
      row: (typeof customers)[number];
      source: (typeof rows)[number];
    }> = [];

    for (const [index, customer] of customers.entries()) {
      const matchId =
        (customer.email ? byEmail.get(customer.email.toLowerCase()) : undefined) ||
        (customer.phone ? byPhone.get(customer.phone.replace(/\D/g, "")) : undefined);
      if (matchId) updateTargets.push({ id: matchId, row: customer, source: rows[index] });
      else inserts.push(customer);
    }

    const inserted: Array<{ id: string; address: string | null; city: string | null; state: string | null; zip_code: string | null }> = [];
    if (inserts.length > 0) {
      const { data, error } = await supabase
        .from("customers")
        .insert(inserts)
        .select("id, address, city, state, zip_code");
      if (error) throw error;
      inserted.push(...(data ?? []));
    }

    let updated = 0;
    for (const target of updateTargets) {
      const changes: Record<string, string | string[] | null> = {
        first_name: target.row.first_name,
        last_name: target.row.last_name,
        full_name: target.row.full_name,
      };
      if (target.source.email) changes.email = target.source.email;
      if (target.source.phone) changes.phone = target.source.phone;
      if (target.source.address) changes.address = target.source.address;
      if (target.source.city) changes.city = target.source.city;
      if (target.source.state) changes.state = target.source.state;
      if (target.source.zip_code) changes.zip_code = target.source.zip_code;
      if (target.source.notes) changes.notes = target.source.notes;
      if (target.source.tags) changes.tags = target.source.tags;
      if (target.source.status) changes.status = target.source.status;
      const { error } = await supabase
        .from("customers")
        .update(changes)
        .eq("id", target.id)
        .eq("org_id", org.orgId);
      if (error) errors.push({ row: 0, error: `Could not update an existing customer: ${error.message}` });
      else updated += 1;
    }

    revalidatePath("/customers");
    revalidatePath("/mapping");

    // Geocode every imported customer that has an address so they show up
    // on the Mapping page. This runs after the insert succeeds and does not
    // block the import result on individual geocoding failures.
    const toGeocode = inserted.filter(
      (c): c is { id: string; address: string; city: string | null; state: string | null; zip_code: string | null } =>
        !!c.address
    );
    if (toGeocode.length > 0) {
      await geocodeCustomersWithLimit(
        supabase,
        toGeocode.map((c) => ({
          id: c.id,
          address: c.address,
          city: c.city ?? undefined,
          state: c.state ?? undefined,
          zip_code: c.zip_code ?? undefined,
        }))
      );
      revalidatePath("/mapping");
    }

    return {
      success: true,
      imported: inserted.length + updated,
      created: inserted.length,
      updated,
      failed: errors.length,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      imported: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [{ row: 0, error: message }],
    };
  }
}
