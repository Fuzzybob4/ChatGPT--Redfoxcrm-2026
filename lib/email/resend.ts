/**
 * Email helpers — server-side only, but NOT declared as "use server" at the
 * module level. Only the individual exported async functions that are called
 * directly from server actions carry that context through their callers.
 *
 * buildHtmlEmail is a pure function (no DB, no RPC) so it must NOT be tagged
 * as a server action — doing so would make it callable from the client as an
 * RPC endpoint, which is a security surface we don't want.
 */

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

// ── Resend client ─────────────────────────────────────────────────────────────

export function getResendClient(): Resend {
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
  enterprise: 8000,
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
        .update({ emails_sent_this_month: 0, month_reset_at: now.toISOString() })
        .eq("org_id", orgId);
      settings.emails_sent_this_month = 0;
    }
  }

  const used = settings?.emails_sent_this_month ?? 0;
  const remaining = Math.max(0, hardLimit - used);
  const overageCount = planType === "enterprise" ? Math.max(0, used - hardLimit) : 0;

  return { used, limit: hardLimit, planType, remaining, overageCount };
}

// ── Build recipient list ──────────────────────────────────────────────────────

export async function buildRecipientList(
  orgId: string,
  segmentFilter: Record<string, unknown>,
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

  const tags = (segmentFilter?.tags as string[] | undefined) ?? [];
  if (tags.length > 0) {
    query = query.overlaps("tags", tags);
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

// ── HTML email builder ────────────────────────────────────────────────────────
// Pure function — no DB access, no async, must NOT be a "use server" action.

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  // Escape every value that appears in the HTML, including org-supplied strings
  const safeFromName = escapeHtml(fromName);
  const safeAddress = escapeHtml(physicalAddress);
  // unsubscribeUrl goes into an href — escape as an attribute value
  const safeUnsubUrl = encodeURI(unsubscribeUrl).replace(/'/g, "%27");

  const bodyHtml = body
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
          <p style="margin:0 0 24px 0;font-size:14px;color:#6b7280;">From: ${safeFromName}</p>
          <div style="font-size:15px;color:#111827;">${bodyHtml}</div>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:24px 48px;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#9ca3af;line-height:1.6;">${safeAddress}</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            You are receiving this email because you opted in to marketing communications.
            <a href="${safeUnsubUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
