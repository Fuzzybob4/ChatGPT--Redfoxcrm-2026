import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * user_memberships.role given to invited crew. Owner/admin stay reserved for
 * the business owner. VERIFY: allowed by any check constraint on
 * user_memberships.role in Supabase.
 */
export const CREW_MEMBERSHIP_ROLE = "member";

/** Written to auth app_metadata by the service role in inviteEmployee. Users cannot edit app_metadata. */
export interface CrewInviteClaim {
  employee_id: string;
  org_id: string;
}

export type AcceptCrewInviteResult =
  | { ok: true; employeeId: string; orgId: string; profileCompleted: boolean }
  | { ok: false; error: "no_invite" | "ambiguous_invite" | "server_error" };

type EmployeeRow = {
  id: string;
  org_id: string;
  email: string | null;
  user_id: string | null;
  invited_at: string | null;
  invite_accepted_at: string | null;
  profile_completed: boolean | null;
  is_active: boolean | null;
};

const COLUMNS = "id, org_id, email, user_id, invited_at, invite_accepted_at, profile_completed, is_active";

/** Escape `%`, `_`, and `\` so an email matches exactly under ILIKE. */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Pending invites are stored inactive until the profile is saved.
 * A revoke clears invited_at. A member deactivated after setup has a finished profile.
 * Neither should get a membership back by opening the old link.
 */
function isAccessRevoked(row: EmployeeRow): boolean {
  return row.is_active === false && (Boolean(row.profile_completed) || !row.invited_at);
}

/**
 * Links the signed-in user to their pending crew invite and creates the
 * user_memberships row. Org, employee and role come only from server-side
 * data (employees row created by the owner + service-role app_metadata),
 * never from form fields or user_metadata. Safe to call repeatedly.
 */
export async function acceptCrewInviteForUser(user: User): Promise<AcceptCrewInviteResult> {
  const resolved = await resolveCrewEmployee(user);
  if (!resolved.ok) return resolved;
  const employee = resolved.employee;
  const admin = createAdminClient();

  if (employee.user_id !== user.id) {
    const { data: updated, error } = await admin
      .from("employees")
      .update({ user_id: user.id, invite_accepted_at: employee.invite_accepted_at ?? new Date().toISOString() })
      .eq("id", employee.id)
      .is("user_id", null)
      .select("id");
    if (error) return serverError("link employee", error);
    if (!updated || updated.length === 0) return { ok: false, error: "no_invite" };
  }

  const { data: membership, error: membershipError } = await admin
    .from("user_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", employee.org_id)
    .maybeSingle();
  if (membershipError) return serverError("membership lookup", membershipError);
  if (!membership) {
    const { error: insertError } = await admin
      .from("user_memberships")
      .insert({ user_id: user.id, org_id: employee.org_id, role: CREW_MEMBERSHIP_ROLE });
    // 23505 = a concurrent request already created it.
    if (insertError && insertError.code !== "23505") return serverError("membership insert", insertError);
  }

  return {
    ok: true,
    employeeId: employee.id,
    orgId: employee.org_id,
    profileCompleted: Boolean(employee.profile_completed),
  };
}

/** Read-only invite lookup. Does not link the employee or create a membership. */
export async function lookupCrewInviteForUser(user: User): Promise<AcceptCrewInviteResult> {
  const resolved = await resolveCrewEmployee(user);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    employeeId: resolved.employee.id,
    orgId: resolved.employee.org_id,
    profileCompleted: Boolean(resolved.employee.profile_completed),
  };
}

async function resolveCrewEmployee(
  user: User,
): Promise<{ ok: true; employee: EmployeeRow } | { ok: false; error: "no_invite" | "ambiguous_invite" | "server_error" }> {
  const email = user.email?.trim().toLowerCase();
  if (!email) return { ok: false, error: "no_invite" };

  const admin = createAdminClient();
  const claim = (user.app_metadata?.redfox_invite ?? null) as Partial<CrewInviteClaim> | null;
  let employee: EmployeeRow | null = null;

  // 1. Already linked to this user (re-entry after a refresh or a second click).
  // Skip revoked rows so a newer pending invite can still match below.
  const { data: linkedRows, error: linkedError } = await admin
    .from("employees")
    .select(COLUMNS)
    .eq("user_id", user.id);
  if (linkedError) return serverError("linked lookup", linkedError);
  const usable = ((linkedRows ?? []) as EmployeeRow[])
    .filter((row) => !isAccessRevoked(row))
    .sort((a, b) => (b.invited_at ?? "").localeCompare(a.invited_at ?? ""));
  if (usable.length > 0) employee = usable[0];

  // 2. The invite claim set at invite time.
  if (!employee && claim?.employee_id) {
    const { data, error } = await admin.from("employees").select(COLUMNS).eq("id", claim.employee_id).maybeSingle();
    if (error) return serverError("claim lookup", error);
    if (
      data &&
      claim.org_id &&
      data.email?.toLowerCase() === email &&
      data.org_id === claim.org_id &&
      data.user_id === null &&
      data.invited_at &&
      !isAccessRevoked(data as EmployeeRow)
    ) {
      employee = data as EmployeeRow;
    }
  }

  // 3. Invites sent before claims existed: exactly one pending row for this email.
  if (!employee) {
    const { data, error } = await admin
      .from("employees")
      .select(COLUMNS)
      .ilike("email", escapeIlike(email))
      .is("user_id", null)
      .is("invite_accepted_at", null)
      .not("invited_at", "is", null)
      .limit(2);
    if (error) return serverError("email lookup", error);
    const pending = ((data ?? []) as EmployeeRow[]).filter((row) => !isAccessRevoked(row));
    if (pending.length === 0) return { ok: false, error: "no_invite" };
    if (pending.length > 1) return { ok: false, error: "ambiguous_invite" };
    employee = pending[0];
  }

  return { ok: true, employee };
}

function serverError(step: string, error: { message?: string; code?: string }): { ok: false; error: "server_error" } {
  console.error(`[crew-invite] ${step} failed`, { code: error.code, message: error.message });
  return { ok: false, error: "server_error" };
}
