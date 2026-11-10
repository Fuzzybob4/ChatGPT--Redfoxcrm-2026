"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";
import { resolveCrew } from "@/lib/crews";
import { membershipRoleFor, sendEmployeeLoginInvite } from "@/lib/crew-accounts";

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
  const crewIdRaw = String(formData.get("crewId") ?? "").trim();
  const canWorkOrders = formData.get("canWorkOrders") === "on";
  const canMapping = formData.get("canMapping") === "on";

  if (!firstName || !lastName || !email) {
    return { error: "First name, last name, and email are required." };
  }

  const org = await getCurrentOrg();
  if (!org) return { error: "Organization not found." };

  const crew = await resolveCrew(createAdminClient(), org.orgId, { crewId: crewIdRaw });
  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    org_id: org.orgId,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`,
    email,
    phone: phone || null,
    position: position || null,
    crew_id: crew?.id ?? null,
    crew_name: crew?.name ?? null,
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
  field: "can_access_work_orders" | "can_access_mapping",
  value: boolean
) {
  if (field !== "can_access_work_orders" && field !== "can_access_mapping") {
    return { error: "Unknown setting." };
  }
  const org = await requireOffice();
  if (!org) return { error: "Only owners, admins, and managers can change crew access." };

  const { error } = await createAdminClient()
    .from("employees")
    .update({ [field]: value })
    .eq("id", employeeId)
    .eq("org_id", org.orgId);

  if (error) return { error: "Couldn't update access. Please try again." };

  revalidatePath("/crew");
  return { success: true };
}

const ROLE_VALUES = new Set([
  "technician",
  "crew_lead",
  "installer",
  "driver",
  "manager",
  "supervisor",
  "sales",
  "office",
]);

export interface EmployeeUpdateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  crewId: string;
  role: string;
}

export async function updateEmployee(employeeId: string, input: EmployeeUpdateInput) {
  const org = await requireOffice();
  if (!org) return { error: "Only owners, admins, and managers can edit crew members." };

  const firstName = input.firstName.trim().slice(0, 80);
  const lastName = input.lastName.trim().slice(0, 80);
  const email = input.email.trim().toLowerCase().slice(0, 254);
  const phone = input.phone.trim().slice(0, 40);
  const position = input.position.trim().slice(0, 80);
  const role = input.role.trim();

  if (!firstName || !lastName) return { error: "First and last name are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!ROLE_VALUES.has(role)) return { error: "Pick a role." };

  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("id, email, user_id")
    .eq("id", employeeId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!employee) return { error: "Crew member not found." };

  // A connected login is tied to its email, so it can't be changed from here.
  if (employee.user_id && email !== (employee.email ?? "").toLowerCase()) {
    return { error: "This person already signs in with their email, so it can't be changed here." };
  }

  if (email !== (employee.email ?? "").toLowerCase()) {
    const { data: duplicate } = await admin
      .from("employees")
      .select("id")
      .eq("org_id", org.orgId)
      .eq("email", email)
      .neq("id", employeeId)
      .maybeSingle();
    if (duplicate) return { error: "Another crew member already uses that email." };
  }

  const crew = await resolveCrew(admin, org.orgId, { crewId: input.crewId });
  const { error } = await admin
    .from("employees")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      email,
      phone: phone || null,
      position: position || null,
      crew_id: crew?.id ?? null,
      crew_name: crew?.name ?? null,
      role,
    })
    .eq("id", employeeId)
    .eq("org_id", org.orgId);
  if (error) return { error: "Couldn't save changes. Please try again." };

  // Keep their app access in step with the role (never touch an owner/admin).
  if (employee.user_id) {
    await admin
      .from("user_memberships")
      .update({ role: membershipRoleFor(role) })
      .eq("user_id", employee.user_id)
      .eq("org_id", org.orgId)
      .in("role", ["manager", "crew"]);
  }

  revalidatePath("/crew");
  revalidatePath("/field", "layout");
  return { success: true };
}

/**
 * Remove someone from the business: they lose access immediately (their
 * membership is deleted) and the employee record is kept, inactive, so past
 * jobs and time entries still show who did the work.
 */
export async function removeEmployee(employeeId: string) {
  const org = await requireOffice();
  if (!org) return { error: "Only owners, admins, and managers can remove crew members." };

  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("id, user_id, invite_accepted_at")
    .eq("id", employeeId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!employee) return { error: "Crew member not found." };

  if (employee.user_id) {
    const { data: membership } = await admin
      .from("user_memberships")
      .select("role")
      .eq("user_id", employee.user_id)
      .eq("org_id", org.orgId)
      .maybeSingle();
    if (membership?.role === "owner") return { error: "The business owner can't be removed." };
  }

  // Setting invite_accepted_at on an inactive record stops the email from being
  // re-linked to the business on a later sign-in.
  const { error } = await admin
    .from("employees")
    .update({
      is_active: false,
      can_access_work_orders: false,
      can_access_mapping: false,
      invite_accepted_at: employee.invite_accepted_at ?? new Date().toISOString(),
    })
    .eq("id", employeeId)
    .eq("org_id", org.orgId);
  if (error) return { error: "Couldn't remove this crew member. Please try again." };

  if (employee.user_id) {
    const { error: membershipError } = await admin
      .from("user_memberships")
      .delete()
      .eq("user_id", employee.user_id)
      .eq("org_id", org.orgId)
      .neq("role", "owner");
    if (membershipError) return { error: "Removed from the crew list, but their access couldn't be revoked. Please try again." };
  }

  revalidatePath("/crew");
  revalidatePath("/jobs");
  return { success: true };
}
