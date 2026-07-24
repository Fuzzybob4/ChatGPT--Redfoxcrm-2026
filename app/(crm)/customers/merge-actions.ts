"use server";

import { createClient } from "@/lib/supabase/server";

export async function mergeCustomers(customerIds: string[]) {
  if (customerIds.length < 2) {
    throw new Error("At least 2 customers are required to merge");
  }

  const supabase = createClient();

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  try {
    // Get all customers to merge
    const { data: customersData, error: fetchError } = await supabase
      .from("customers")
      .select("*")
      .in("id", customerIds);

    if (fetchError) {
      throw new Error(`Failed to fetch customers: ${fetchError.message}`);
    }

    if (!customersData || customersData.length < 2) {
      throw new Error("Could not find all customers to merge");
    }

    // Primary customer is the first one
    const primaryCustomer = customersData[0];
    const duplicateIds = customerIds.slice(1);

    // Merge data: keep primary, fill in missing fields from duplicates
    const mergedData = {
      name: primaryCustomer.name,
      email: primaryCustomer.email || customersData.find((c) => c.email)?.email,
      phone: primaryCustomer.phone || customersData.find((c) => c.phone)?.phone,
      address:
        primaryCustomer.address ||
        customersData.find((c) => c.address)?.address,
      city: primaryCustomer.city || customersData.find((c) => c.city)?.city,
      state:
        primaryCustomer.state || customersData.find((c) => c.state)?.state,
      zip: primaryCustomer.zip || customersData.find((c) => c.zip)?.zip,
      notes: primaryCustomer.notes
        ? `${primaryCustomer.notes}\n\nMerged from: ${customersData
            .slice(1)
            .map((c) => `${c.name} (${c.email})`)
            .join(", ")}`
        : `Merged from: ${customersData
            .slice(1)
            .map((c) => `${c.name} (${c.email})`)
            .join(", ")}`,
    };

    // Update primary customer with merged data
    const { error: updateError } = await supabase
      .from("customers")
      .update(mergedData)
      .eq("id", primaryCustomer.id);

    if (updateError) {
      throw new Error(`Failed to update primary customer: ${updateError.message}`);
    }

    // Move all records from duplicate customers to primary
    const tables = [
      "invoices",
      "estimates",
      "work_orders",
      "work_order_requests",
      "customer_photos",
      "customer_properties",
      "jobs",
    ];

    for (const table of tables) {
      const { error: moveError } = await supabase
        .from(table)
        .update({ customer_id: primaryCustomer.id })
        .in("customer_id", duplicateIds);

      if (moveError) {
        console.error(`Warning: Failed to move ${table} records:`, moveError);
      }
    }

    // Delete duplicate customers
    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) {
      throw new Error(`Failed to delete duplicate customers: ${deleteError.message}`);
    }

    return {
      success: true,
      message: `Successfully merged ${customerIds.length} customers into "${primaryCustomer.name}"`,
      primaryCustomerId: primaryCustomer.id,
    };
  } catch (error) {
    console.error("[v0] Merge customers error:", error);
    throw error;
  }
}
