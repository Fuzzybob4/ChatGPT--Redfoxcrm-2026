"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";
import { authConfirmRedirect } from "@/lib/auth-link-origin";
import { CREW_MEMBERSHIP_ROLE, escapeIlike, type CrewInviteClaim } from "@/lib/crew-invite";

const ORG_ADMIN_ROLES = new Set(["owner", "admin"]);

export async function inviteEmployee(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();

  if (!email || !role) {
    return { error: "Email and role are required." };
  }

  const org = await getCurrentOrg();
  if (!org) return { error: "Organization not found." };
  // Crew now get a membership too, so only owners/admins may invite.
  if (!ORG_ADMIN_ROLES.has(org.role)) return { error: "Only owners and admins can invite crew." };

  const adminClient = createAdminClient();

  // Re-inviting a pending or revoked address resends the email instead of adding a duplicate row.
  const { data: pending, error: pendingError } = await adminClient
    .from("employees")
    .select("id, user_id, invite_accepted_at")
    .eq("org_id", org.orgId)
    .ilike("email", escapeIlike(email))
    .not("invited_at", "is", null)
    .limit(1)
    .maybeSingle();
  if (pendingError) return { error: pendingError.message };

  let existing = pending;
  if (!existing) {
    // Revoke clears invited_at. Match that empty shell, not a manually added crew row (those have a name).
    const { data: revoked, error: revokedError } = await adminClient
      .from("employees")
      .select("id, user_id, invite_accepted_at")
      .eq("org_id", org.orgId)
      .ilike("email", escapeIlike(email))
      .is("invited_at", null)
      .is("user_id", null)
      .is("invite_accepted_at", null)
      .eq("profile_completed", false)
      .eq("is_active", false)
      .eq("first_name", "")
      .limit(1)
      .maybeSingle();
    if (revokedError) return { error: revokedError.message };
    existing = revoked;
  }
  if (existing && (existing.user_id || existing.invite_accepted_at)) {
    return { error: "This person has already accepted an invite." };
  }

  let employeeId = existing?.id as string | undefined;
  const createdRow = !employeeId;
  if (employeeId) {
    const { error: refreshError } = await adminClient
      .from("employees")
      .update({
        invited_at: new Date().toISOString(),
        role,
        position: position || role,
        is_active: false,
        profile_completed: false,
      })
      .eq("id", employeeId)
      .eq("org_id", org.orgId)
      .is("user_id", null);
    if (refreshError) return { error: refreshError.message };
  } else {
    // Create the employee record (no name yet — filled on profile setup)
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
        is_active: false, // becomes active after profile setup
        can_access_work_orders: true,
        can_access_mapping: false,
        invited_at: new Date().toISOString(),
        profile_completed: false,
      })
      .select("id")
      .single();

    if (insertError) return { error: insertError.message };
    employeeId = empRow.id as string;
  }

  if (!employeeId) return { error: "Failed to send invite email. Please try again." };

  // Send Supabase invite email so they can set their password. The email
  // template links to /auth/confirm (token_hash), which sends invites to
  // /auth/set-password. NEXT_PUBLIC_SITE_URL was unset in production, so the
  // old link fell back to the Supabase Site URL (http://redfoxcrm.com).
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: await authConfirmRedirect("/auth/set-password"),
  });

  if (inviteError || !invited?.user) {
    console.error("[inviteEmployee] inviteUserByEmail failed", inviteError?.message);
    // Roll back the employee row if invite failed
    if (createdRow) await adminClient.from("employees").delete().eq("id", employeeId);
    return { error: "Failed to send invite email. Please try again." };
  }

  // Server-trusted invite claim: app_metadata is writable only with the
  // service role (user_metadata is user-editable and must not be used).
  const claim: CrewInviteClaim = { employee_id: employeeId, org_id: org.orgId };
  const { error: claimError } = await adminClient.auth.admin.updateUserById(invited.user.id, {
    // Merge so provider and other service-role keys are kept if this call replaces app_metadata.
    app_metadata: { ...(invited.user.app_metadata ?? {}), redfox_invite: claim },
  });
  if (claimError) {
    // Acceptance still works via the single pending employee row for this email.
    console.error("[inviteEmployee] could not store invite claim", claimError.message);
  }

  revalidatePath("/crew");
  return { success: true };
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
  const org = await getCurrentOrg();
  if (!org) return { error: "Organization not found." };
  if (!ORG_ADMIN_ROLES.has(org.role)) return { error: "Only owners and admins can remove crew." };

  const supabase = await createClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .update({ is_active: false })
    .eq("id", employeeId)
    .eq("org_id", org.orgId)
    .select("id, user_id, invite_accepted_at")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!employee) return { error: "Crew member not found." };

  if (!employee.user_id && !employee.invite_accepted_at) {
    // Revoke a pending invite so the emailed link can no longer be accepted.
    const { error: revokeError } = await supabase
      .from("employees")
      .update({ invited_at: null })
      .eq("id", employee.id)
      .eq("org_id", org.orgId);
    if (revokeError) return { error: revokeError.message };
  } else if (employee.user_id && employee.user_id !== org.userId) {
    // Clear invited_at before dropping the membership so a refresh cannot recreate it.
    const { error: revokeError } = await supabase
      .from("employees")
      .update({ invited_at: null })
      .eq("id", employee.id)
      .eq("org_id", org.orgId);
    if (revokeError) return { error: revokeError.message };

    const { error: membershipError } = await createAdminClient()
      .from("user_memberships")
      .delete()
      .eq("user_id", employee.user_id)
      .eq("org_id", org.orgId)
      .eq("role", CREW_MEMBERSHIP_ROLE);
    if (membershipError) return { error: membershipError.message };
  }

  revalidatePath("/crew");
  return { success: true };
}
