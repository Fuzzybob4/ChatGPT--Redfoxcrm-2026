"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";
import { ensurePortalToken } from "@/lib/estimates/approval";
import { appBaseUrl, getBusinessSender, renderEmail } from "@/lib/email/transactional";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { returningKind } from "@/lib/rebooking";

const OFFICE = ["owner", "admin", "manager"];

async function office() {
  const org = await getCurrentOrg();
  if (!org || !OFFICE.includes(String(org.role ?? "").toLowerCase())) return null;
  return org;
}

export async function saveRebookSettings(input: {
  enabled: boolean;
  windowStart: string;
  windowEnd: string;
  leadDays: number;
}): Promise<{ ok: true } | { error: string }> {
  const org = await office();
  if (!org) return { error: "Only the owner or a manager can change this." };
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (input.enabled && !date.test(input.windowStart)) return { error: "Pick the first day customers can book." };
  if (input.windowEnd && !date.test(input.windowEnd)) return { error: "Pick the last day customers can book." };
  if (input.windowEnd && input.windowStart && input.windowEnd < input.windowStart) return { error: "The last day has to be after the first day." };
  const lead = Math.max(0, Math.min(30, Math.round(Number(input.leadDays) || 0)));
  const db = createAdminClient();
  const { error } = await db.from("schedule_settings").upsert(
    {
      org_id: org.orgId,
      rebook_enabled: input.enabled,
      rebook_window_start: input.windowStart || null,
      rebook_window_end: input.windowEnd || null,
      rebook_lead_days: lead,
    },
    { onConflict: "org_id" },
  );
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/settings");
  revalidatePath("/customers/rebook");
  return { ok: true };
}

/** The customer's own booking link (returning customers only). */
export async function getBookingLink(customerId: string): Promise<
  { ok: true; url: string; phone: string | null; firstName: string; businessName: string } | { error: string }
> {
  const org = await office();
  if (!org) return { error: "Only the owner or a manager can send booking links." };
  const db = createAdminClient();
  const { data: c } = await db
    .from("customers")
    .select("id, first_name, phone")
    .eq("id", customerId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!c) return { error: "Customer not found." };
  if (!(await returningKind(db, org.orgId, customerId))) {
    return { error: "Booking links are for returning customers (past installs or customer-owned lights)." };
  }
  const token = await ensurePortalToken(db, customerId, org.orgId);
  const business = await getBusinessSender(db, org.orgId);
  return {
    ok: true,
    url: `${appBaseUrl()}/book/${encodeURIComponent(token)}`,
    phone: (c.phone as string | null) ?? null,
    firstName: (c.first_name as string | null) ?? "",
    businessName: business.name,
  };
}

/** Email booking links to the chosen returning customers. Skips anyone without an email. */
export async function emailBookingLinks(customerIds: string[]): Promise<{ ok: true; sent: number; skipped: number } | { error: string }> {
  const org = await office();
  if (!org) return { error: "Only the owner or a manager can send booking links." };
  if (!isEmailConfigured()) return { error: "Email isn't set up." };
  const ids = [...new Set(customerIds)].slice(0, 500);
  const db = createAdminClient();
  const business = await getBusinessSender(db, org.orgId);
  const { data: customers } = await db
    .from("customers")
    .select("id, first_name, email, do_not_contact, marketing_unsubscribed")
    .eq("org_id", org.orgId)
    .in("id", ids);
  let sent = 0;
  let skipped = 0;
  for (const c of customers ?? []) {
    if (!c.email || (c as any).do_not_contact || (c as any).marketing_unsubscribed || !(await returningKind(db, org.orgId, c.id))) {
      skipped++;
      continue;
    }
    const token = await ensurePortalToken(db, c.id, org.orgId);
    const url = `${appBaseUrl()}/book/${encodeURIComponent(token)}`;
    const r = await sendEmail({
      to: c.email,
      subject: `Pick your holiday lighting install day`,
      fromName: business.name,
      replyTo: business.email,
      html: renderEmail({
        business,
        greeting: `Hi ${c.first_name || "there"},`,
        paragraphs: [
          `Thanks for lighting up with ${business.name} last season! Booking for this season is open, and returning customers get first pick.`,
          "Pick the day and time that works for you. It takes about 30 seconds.",
        ],
        button: { text: "Pick my install day", url },
      }),
    }).catch(() => null);
    if (r) sent++;
    else skipped++;
  }
  return { ok: true, sent, skipped };
}
