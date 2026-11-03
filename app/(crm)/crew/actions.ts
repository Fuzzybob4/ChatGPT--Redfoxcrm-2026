"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";
import { sendEmployeeLoginInvite } from "@/lib/crew-accounts";

export async function inviteEmployee(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();

  if (!email || !role) {
    return { error: "Email and role are required." };
  }

  const org = await requireOffice();
  if (!org) return { error: "Only owners, admins, and managers can invite employees." };

  const adminClient = createAdminClient();

  // Reuse the employee record if one already exists for this email.
  const { data: existing } = await adminClient
    .from("employees")
    .select("id, user_id")
    .eq("org_id", org.orgId)
    .eq("email", email)
    .maybeSingle();

  if (existing?.user_id) {
    return { error: "This employee already has a login. They can sign in with this email." };
  }

  let employeeId = existing?.id as string | undefined;
  let created = false;
  if (!employeeId) {
    // Name and legal details are filled in by the employee during setup.
    const { data: empRow, error: insertError } = await adminClient
      .from("employees")
      .insert({
        org_id: org.orgId,
        first_name: "",
        last_name: "",
        full_name: "",
        email,
        role,
        position: position || role,
        is_active: false,
        can_access_work_orders: true,
        can_access_mapping: false,
        invited_at: new Date().toISOString(),
        profile_completed: false,
      })
      .select("id")
      .single();
    if (insertError || !empRow) return { error: insertError?.message ?? "Could not create employee." };
    employeeId = empRow.id;
    created = true;
  }

  const result = await sendEmployeeLoginInvite(employeeId!, email);
  if ("error" in result) {
    if (created) await adminClient.from("employees").delete().eq("id", employeeId!);
    return { error: result.error };
  }

  revalidatePath("/crew");
  return { success: true, existingAccount: result.existingAccount };
}

/** Send (or resend) a login invite to an employee who was added manually. */
export async function sendLoginInvite(employeeId: string) {
  const org = await requireOffice();
  if (!org) return { error: "Only owners, admins, and managers can invite employees." };

  const adminClient = createAdminClient();
  const { data: employee } = await adminClient
    .from("employees")
    .select("id, email, user_id")
    .eq("id", employeeId)
    .eq("org_id", org.orgId)
    .maybeSingle();

  if (!employee) return { error: "Employee not found." };
  if (employee.user_id) return { error: "This employee already has a login." };
  if (!employee.email) return { error: "Add an email address for this employee first." };

  const result = await sendEmployeeLoginInvite(employee.id, employee.email.trim().toLowerCase());
  if ("error" in result) return { error: result.error };

  revalidatePath("/crew");
  return { success: true, existingAccount: result.existingAccount };
}

async function requireOffice() {
  const org = await getCurrentOrg();
  if (!org || !["owner", "admin", "manager"].includes(org.role)) return null;
  return org;
}

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
