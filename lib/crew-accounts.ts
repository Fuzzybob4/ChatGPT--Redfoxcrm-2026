import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Employee positions that should get office (CRM) access instead of the
// crew field app.
const OFFICE_POSITIONS = new Set(["manager", "supervisor", "office"]);

export function membershipRoleFor(employeeRole: string | null | undefined): "manager" | "crew" {
  return OFFICE_POSITIONS.has((employeeRole ?? "").toLowerCase()) ? "manager" : "crew";
}

interface AuthUserLike {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}

/**
 * Connect a signed-in user to the employee record that was created for their
 * email address, and give them a membership in that business.
 *
 * Only confirmed email addresses are linked, so nobody can claim an employee
 * record by signing up with someone else's unverified address.
 * Returns true when a membership exists (or was created) for the user.
 */
export async function linkEmployeeAccount(user: AuthUserLike): Promise<boolean> {
  const email = user.email?.trim().toLowerCase();
  if (!email || !user.email_confirmed_at) return false;

  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("employees")
    .select("id, org_id, role, user_id, is_active, invite_accepted_at")
    .eq("email", email)
    .order("created_at", { ascending: true })
    .limit(10);

  // Skip records linked to another login and employees who were deactivated
  // after joining (invited-but-not-yet-joined records are still eligible).
  const employee = (candidates ?? []).find(
    (e) =>
      (!e.user_id || e.user_id === user.id) &&
      (e.is_active || !e.invite_accepted_at),
  );
  if (!employee) return false;

  const now = new Date().toISOString();
  const { error: linkError } = await admin
    .from("employees")
    .update({
      user_id: user.id,
      is_active: true,
      invite_accepted_at: employee.invite_accepted_at ?? now,
    })
    .eq("id", employee.id);
  if (linkError) return false;

  const { data: existing } = await admin
    .from("user_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", employee.org_id)
    .maybeSingle();

  if (!existing) {
    const { error: memberError } = await admin.from("user_memberships").insert({
      user_id: user.id,
      org_id: employee.org_id,
      role: membershipRoleFor(employee.role),
    });
    if (memberError) {
      // Parallel requests on first sign-in can race to create the membership;
      // succeed if another request already did.
      const { data: raced } = await admin
        .from("user_memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("org_id", employee.org_id)
        .maybeSingle();
      if (!raced) return false;
    }
  }

  return true;
}

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/**
 * Email an employee a link to create their password. If the address already
 * has a RedFox login, they can simply sign in with it — the account is linked
 * to the business automatically on their next sign-in.
 */
export async function sendEmployeeLoginInvite(
  employeeId: string,
  email: string,
): Promise<{ success: true; existingAccount: boolean } | { error: string }> {
  const admin = createAdminClient();
  const origin = await siteOrigin();

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(`/crew-setup?employee_id=${employeeId}`)}`,
  });

  if (error) {
    const alreadyRegistered = /already (been )?registered|already exists/i.test(error.message);
    if (alreadyRegistered) {
      // They already made a RedFox login before. Email them a sign-in link so they
      // actually get something; signing in links them to the business.
      const { error: linkError } = await admin.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(`/crew-setup?employee_id=${employeeId}`)}`,
        },
      });
      if (linkError) {
        console.error("[crew-invite] sign-in link failed:", linkError.message);
        if (/rate limit|security purposes/i.test(linkError.message)) {
          return { error: "Too many emails sent recently. Wait a minute and try again." };
        }
        return { error: "Could not send the sign-in email. Please try again." };
      }
      await admin.from("employees").update({ invited_at: new Date().toISOString() }).eq("id", employeeId);
      return { success: true, existingAccount: true };
    }
    console.error("[crew-invite] inviteUserByEmail failed:", error.message);
    if (/rate limit/i.test(error.message)) {
      return { error: "Too many emails sent recently. Wait a few minutes and try again." };
    }
    if (/smtp|send email|not authorized|unexpected_failure/i.test(error.message) || error.status === 500) {
      return {
        error:
          "The email service rejected this invite. The sender address in your Supabase SMTP settings must use a verified domain (e.g. no-reply@redfoxcrm.com).",
      };
    }
    return { error: "Could not send the invite email. Please try again." };
  }

  await admin
    .from("employees")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", employeeId);

  return { success: true, existingAccount: false };
}
