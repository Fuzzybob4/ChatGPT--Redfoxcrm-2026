"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

// Lazily instantiated – each call creates a client using the org's own API key
// if they've configured one, otherwise falls back to the platform key.
export async function getResendClient(): Promise<Resend> {
  // Platform-level key stored in env (for sending on behalf of the platform
  // before orgs add their own custom domain). Orgs send from their own
  // verified domain via Resend's sending domains API.
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  return new Resend(key);
}

// ── Plan quota limits ─────────────────────────────────────────────────────────
const PLAN_LIMITS: Record<string, number> = {
  basic: 2000,
  starter: 2000,
  pro: 4000,
  professional: 4000,
  enterprise: Infinity, // billed per 1 000 over 8 000 base
};

export async function getMonthlyQuota(orgId: string): Promise<{
  used: number;
  limit: number;
  planType: string;
  remaining: number;
  overageCount: number;
}> {
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_type")
    .eq("org_id", orgId)
    .maybeSingle();

  const planType = (sub?.plan_type ?? "basic").toLowerCase();
  const baseLimit = planType === "enterprise" ? 8000 : (PLAN_LIMITS[planType] ?? 2000);
  const hardLimit = PLAN_LIMITS[planType] ?? 2000;

  const { data: settings } = await supabase
    .from("org_email_settings")
    .select("emails_sent_this_month, month_reset_at")
    .eq("org_id", orgId)
    .maybeSingle();

  // Auto-reset counter if we've crossed into a new calendar month
  if (settings) {
    const resetAt = new Date(settings.month_reset_at);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      await supabase
        .from("org_email_settings")
        .update({ emails_sent_this_month: 0, month_reset_at: new Date().toISOString() })
        .eq("org_id", orgId);
      settings.emails_sent_this_month = 0;
    }
  }

  const used = settings?.emails_sent_this_month ?? 0;
  const remaining = Math.max(0, hardLimit - used);
  const overageCount = planType === "enterprise" ? Math.max(0, used - baseLimit) : 0;

  return { used, limit: hardLimit, planType, remaining, overageCount };
}

// ── Build recipient list from opted-in customers ──────────────────────────────
export async function buildRecipientList(
  orgId: string,
  segmentFilter: Record<string, any>,
): Promise<{ email: string; customerId: string; name: string }[]> {
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("id, full_name, email")
    .eq("org_id", orgId)
    .eq("marketing_opt_in", true)
    .eq("marketing_unsubscribed", false)
    .eq("status", "active")
    .not("email", "is", null)
    .neq("email", "");

  // Optional tag filter
  if (segmentFilter?.tags?.length > 0) {
    query = query.overlaps("tags", segmentFilter.tags);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((c) => c.email)
    .map((c) => ({
      email: c.email as string,
      customerId: c.id,
      name: c.full_name ?? "Valued Customer",
    }));
}

// ── Wrap a plain-text body into a minimal compliant HTML email ────────────────
export function buildHtmlEmail({
  body,
  fromName,
  physicalAddress,
  unsubscribeUrl,
}: {
  body: string;
  fromName: string;
  physicalAddress: string;
  unsubscribeUrl: string;
}): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map((l) => `<p style="margin:0 0 12px 0;line-height:1.6;">${l || "&nbsp;"}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:40px 48px 32px;">
          <p style="margin:0 0 24px 0;font-size:14px;color:#6b7280;">From: ${fromName}</p>
          <div style="font-size:15px;color:#111827;">${escaped}</div>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:24px 48px;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#9ca3af;line-height:1.6;">${physicalAddress}</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            You are receiving this email because you opted in to marketing communications.
            <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
