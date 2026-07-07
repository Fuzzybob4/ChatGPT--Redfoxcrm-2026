"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

export async function addEmployee(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const crewName = String(formData.get("crewName") ?? "").trim();
  const canWorkOrders = formData.get("canWorkOrders") === "on";
  const canMapping = formData.get("canMapping") === "on";

  if (!firstName || !lastName || !email) {
    return { error: "First name, last name, and email are required." };
  }

  const org = await getCurrentOrg();
  if (!org) return { error: "Organization not found." };

  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    org_id: org.orgId,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`,
    email,
    phone: phone || null,
    position: position || null,
    crew_name: crewName || null,
    role: position.toLowerCase().includes("lead") ? "crew_lead" : "technician",
    is_active: true,
    can_access_work_orders: canWorkOrders,
    can_access_mapping: canMapping,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/crew");
  return { success: true };
}

export async function updateEmployeeAccess(
  employeeId: string,
  field: "can_access_work_orders" | "can_access_mapping" | "is_active",
  value: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ [field]: value })
    .eq("id", employeeId);

  if (error) return { error: error.message };

  revalidatePath("/crew");
  return { success: true };
}

export async function removeEmployee(employeeId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ is_active: false })
    .eq("id", employeeId);

  if (error) return { error: error.message };

  revalidatePath("/crew");
  return { success: true };
}
