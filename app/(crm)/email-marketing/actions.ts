"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import {
  getResendClient,
  getMonthlyQuota,
  buildRecipientList,
  buildHtmlEmail,
} from "@/lib/email/resend";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CampaignInput {
  name: string;
  subject: string;
  previewText: string;
  campaignType: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  htmlBody: string;
  textBody: string;
  segmentFilter: Record<string, any>;
  scheduledAt?: string;
}

// ── Create / save a campaign draft ───────────────────────────────────────────
export async function saveCampaign(id: string | null, input: CampaignInput) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const row = {
    org_id: org.orgId,
    name: input.name,
    subject: input.subject,
    preview_text: input.previewText,
    campaign_type: input.campaignType,
    from_name: input.fromName,
    from_email: input.fromEmail,
    reply_to: input.replyTo || null,
    html_body: input.htmlBody,
    text_body: input.textBody,
    segment_filter: input.segmentFilter,
    scheduled_at: input.scheduledAt || null,
    status: input.scheduledAt ? "scheduled" : "draft",
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase
      .from("email_campaigns")
      .update(row)
      .eq("id", id)
      .eq("org_id", org.orgId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("email_campaigns").insert(row);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/email-marketing");
}

// ── Delete a campaign ─────────────────────────────────────────────────────────
export async function deleteCampaign(id: string) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("email_campaigns")
    .delete()
    .eq("id", id)
    .eq("org_id", org.orgId);

  if (error) throw new Error(error.message);
  revalidatePath("/email-marketing");
}

// ── Send a campaign ───────────────────────────────────────────────────────────
export async function sendCampaign(campaignId: string): Promise<{ sent: number; skipped: number }> {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  // Load campaign
  const { data: campaign, error: cErr } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("org_id", org.orgId)
    .single();
  if (cErr || !campaign) throw new Error("Campaign not found");
  if (campaign.status === "sent") throw new Error("Campaign already sent");

  // Load org email settings (from_address, physical_address)
  const { data: settings } = await supabase
    .from("org_email_settings")
    .select("*")
    .eq("org_id", org.orgId)
    .maybeSingle();

  const fromName = campaign.from_name || settings?.from_name || "Your Company";
  const fromEmail = campaign.from_email || settings?.from_email;
  if (!fromEmail) throw new Error("No sending email address configured. Set one in Email Settings.");

  const physicalAddress = settings?.physical_address || "";
  if (!physicalAddress) throw new Error("A physical mailing address is required by CAN-SPAM law. Add one in Email Settings.");

  // Check quota
  const quota = await getMonthlyQuota(org.orgId);
  if (quota.remaining === 0 && quota.planType !== "enterprise") {
    throw new Error(
      `Monthly send limit reached (${quota.limit.toLocaleString()} emails on the ${quota.planType} plan). Upgrade to send more.`
    );
  }

  // Build recipient list (opted-in, not unsubscribed)
  const recipients = await buildRecipientList(org.orgId, campaign.segment_filter ?? {});
  if (recipients.length === 0) throw new Error("No opted-in contacts match this segment.");

  // Respect quota cap for non-enterprise plans
  const allowed = quota.planType === "enterprise" ? recipients : recipients.slice(0, quota.remaining);
  const skipped = recipients.length - allowed.length;

  const resend = await getResendClient();
  let sent = 0;

  // Send in batches of 50 to respect Resend rate limits
  const BATCH = 50;
  for (let i = 0; i < allowed.length; i += BATCH) {
    const batch = allowed.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (recipient) => {
        const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(recipient.email)}&org=${org.orgId}`;
        const html =
          campaign.html_body ||
          buildHtmlEmail({
            body: campaign.text_body ?? "",
            fromName,
            physicalAddress,
            unsubscribeUrl: unsubUrl,
          });

        const { data, error } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: recipient.email,
          subject: campaign.subject,
          html,
          text: campaign.text_body ?? undefined,
          replyTo: campaign.reply_to ?? undefined,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        if (!error) {
          sent++;
          // Log the send
          await supabase.from("email_sends").insert({
            org_id: org.orgId,
            campaign_id: campaignId,
            customer_id: recipient.customerId,
            to_email: recipient.email,
            resend_email_id: data?.id ?? null,
            status: "sent",
          });
        }
      })
    );
  }

  // Update campaign status + counters
  await supabase
    .from("email_campaigns")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipient_count: sent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  // Increment monthly usage
  await supabase.rpc("increment_emails_sent", { p_org_id: org.orgId, p_count: sent }).then(() => {});
  // Fallback if RPC not yet created: direct update
  if (settings) {
    await supabase
      .from("org_email_settings")
      .update({ emails_sent_this_month: (settings.emails_sent_this_month ?? 0) + sent })
      .eq("org_id", org.orgId);
  }

  revalidatePath("/email-marketing");
  return { sent, skipped };
}

// ── Save org email settings ───────────────────────────────────────────────────
export async function saveEmailSettings(input: {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  physicalAddress: string;
}) {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("org_email_settings")
    .upsert({
      org_id: org.orgId,
      from_name: input.fromName,
      from_email: input.fromEmail,
      reply_to: input.replyTo || null,
      physical_address: input.physicalAddress,
      updated_at: new Date().toISOString(),
    });

  if (error) throw new Error(error.message);
  revalidatePath("/email-marketing");
}

// ── Load campaigns (server-side for the page) ─────────────────────────────────
export async function getCampaigns() {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) return [];

  const { data } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("org_id", org.orgId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

// ── Load opted-in contact count ───────────────────────────────────────────────
export async function getOptInStats() {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) return { total: 0, optedIn: 0 };

  const { count: total } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("org_id", org.orgId);

  const { count: optedIn } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("org_id", org.orgId)
    .eq("marketing_opt_in", true)
    .eq("marketing_unsubscribed", false);

  return { total: total ?? 0, optedIn: optedIn ?? 0 };
}

// ── Load email settings ───────────────────────────────────────────────────────
export async function getEmailSettings() {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) return null;

  const { data } = await supabase
    .from("org_email_settings")
    .select("*")
    .eq("org_id", org.orgId)
    .maybeSingle();

  return data;
}
