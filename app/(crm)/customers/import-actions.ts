"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";

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
  failed: number;
  errors: Array<{ row: number; error: string }>;
}> {
  try {
    const org = await getCurrentOrg();
    if (!org) return { success: false, imported: 0, failed: 0, errors: [{ row: 0, error: "Organization not found" }] };

    const supabase = await createClient();

    // Parse CSV text
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      return { success: false, imported: 0, failed: 0, errors: [{ row: 0, error: "CSV must have header and at least one data row" }] };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    
    // Support multiple column name variations
    const findHeader = (names: string[]) => headers.findIndex((h) => names.includes(h));
    
    const firstNameIdx = findHeader(["first name", "firstname"]);
    const lastNameIdx = findHeader(["last name", "lastname"]);
    const nameIdx = findHeader(["name"]);
    const emailIdx = findHeader(["email"]);
    const phoneIdx = findHeader(["phone", "phone number"]);
    const addressIdx = findHeader(["address", "street address", "street"]);
    const cityIdx = findHeader(["city"]);
    const stateIdx = findHeader(["state"]);
    const zipIdx = findHeader(["zip", "zip code", "postal code"]);

    // Check if we have a name field or first/last name
    if (nameIdx === -1 && (firstNameIdx === -1 || lastNameIdx === -1)) {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, error: 'CSV must have either "name" or "first name"/"last name" columns' }],
      };
    }

    const rows: CustomerImportRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      
      // Build name from either "name" column or "first name" + "last name"
      let name = nameIdx !== -1 ? values[nameIdx] : "";
      if (!name && firstNameIdx !== -1 && lastNameIdx !== -1) {
        const first = values[firstNameIdx] || "";
        const last = values[lastNameIdx] || "";
        name = `${first} ${last}`.trim();
      }

      if (!name) {
        errors.push({ row: i + 1, error: "Name is required" });
        continue;
      }

      rows.push({
        name,
        email: values[emailIdx] || undefined,
        phone: values[phoneIdx] || undefined,
        address: values[addressIdx] || undefined,
        city: values[cityIdx] || undefined,
        state: values[stateIdx] || undefined,
        zip: values[zipIdx] || undefined,
        locationId: locationId || undefined,
      });
    }

    if (rows.length === 0) {
      return {
        success: false,
        imported: 0,
        failed: errors.length,
        errors,
      };
    }

    // Insert into Supabase
    const customers = rows.map((row) => ({
      org_id: org.orgId,
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      address: row.address || null,
      city: row.city || null,
      state: row.state || null,
      zip: row.zip || null,
      location_id: row.locationId || null,
      status: "active" as const,
    }));

    const { error } = await supabase.from("customers").insert(customers);

    if (error) {
      return {
        success: false,
        imported: 0,
        failed: rows.length,
        errors: [{ row: 0, error: error.message }],
      };
    }

    revalidatePath("/customers");

    return {
      success: true,
      imported: rows.length,
      failed: errors.length,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      imported: 0,
      failed: 0,
      errors: [{ row: 0, error: message }],
    };
  }
}
