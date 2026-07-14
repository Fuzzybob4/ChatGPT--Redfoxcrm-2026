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
