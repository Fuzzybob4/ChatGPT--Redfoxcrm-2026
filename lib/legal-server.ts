import { LEGAL_VERSION } from "@/lib/legal";

/** Save that a business accepted the current Terms and Privacy Policy. */
export async function recordTermsAcceptance(
  admin: any,
  orgId: string,
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null; acceptedAt?: string } = {},
) {
  const at = meta.acceptedAt ?? new Date().toISOString();
  await admin.from("terms_acceptances").insert({
    org_id: orgId,
    user_id: userId,
    version: LEGAL_VERSION,
    accepted_at: at,
    ip: meta.ip?.slice(0, 64) ?? null,
    user_agent: meta.userAgent?.slice(0, 300) ?? null,
  });
  await admin
    .from("organizations")
    .update({ terms_version: LEGAL_VERSION, terms_accepted_at: at, terms_accepted_by: userId })
    .eq("id", orgId);
}

/**
 * True when the owner still needs to accept the current version. A brand-new
 * signup who checked the box at signup is recorded here instead of asked again.
 */
export async function needsTermsAcceptance(admin: any, orgId: string, role: string, user: any): Promise<boolean> {
  if (!["owner", "admin"].includes(role)) return false;
  const { data } = await admin.from("organizations").select("terms_version").eq("id", orgId).maybeSingle();
  if (data?.terms_version === LEGAL_VERSION) return false;
  const meta = user?.user_metadata ?? {};
  if (meta.terms_version === LEGAL_VERSION && user?.id) {
    await recordTermsAcceptance(admin, orgId, user.id, { acceptedAt: meta.terms_accepted_at, userAgent: "signup checkbox" });
    return false;
  }
  return true;
}
