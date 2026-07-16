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

    const rows: Array<{
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      location_id?: string;
    }> = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      
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
        location_id: locationId || undefined,
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

    // Insert into Supabase - only include columns that exist in the schema
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
      location_id: row.location_id || null,
      install_status: "not_started" as const,
      marketing_opt_in: false,
      marketing_unsubscribed: false,
      tags: [],
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
