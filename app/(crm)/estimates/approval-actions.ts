"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ESTIMATE_COLUMNS,
  approveEstimateAndCreateInvoice,
  newApprovalToken,
  type EstimateRow,
} from "@/lib/estimates/approval";

export interface EstimateApprovalInfo {
  link: string | null;
  depositPercent: number;
  sentAt: string | null;
  viewedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  invoiceId: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  /** Last time it was actually emailed through RedFox, and to whom. */
  emailedAt: string | null;
  emailedTo: string | null;
  /** Customer opens (owner previews are not counted). */
  viewCount: number;
  lastViewedAt: string | null;
  images: { name: string }[];
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.redfoxcrm.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function loadOwned(estimateId: string) {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not signed in");
  const db = createAdminClient();
  const { data, error } = await db
    .from("estimates")
    .select(
      ESTIMATE_COLUMNS +
        ", approval_token, sent_at, viewed_at, approved_at, approved_by_name, declined_at, decline_reason, images, view_count, last_viewed_at",
    )
    .eq("id", estimateId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (error || !data) throw new Error("Estimate not found");
  return { org, db, estimate: data as unknown as EstimateRow & Record<string, any> };
}

export async function getEstimateApprovalInfo(estimateId: string): Promise<EstimateApprovalInfo> {
  const { db, estimate } = await loadOwned(estimateId);
  const [{ data: customer }, { data: lastEmail }] = await Promise.all([
    db.from("customers").select("phone, email").eq("id", estimate.customer_id).eq("org_id", estimate.org_id).maybeSingle(),
    db
      .from("invoice_reminder_log")
      .select("email_address, created_at")
      .eq("estimate_id", estimate.id)
      .eq("org_id", estimate.org_id)
      .eq("kind", "estimate_sent")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    link: estimate.approval_token ? `${await origin()}/estimate/${estimate.approval_token}` : null,
    depositPercent: Number(estimate.deposit_percent ?? 0),
    sentAt: estimate.sent_at ?? null,
    viewedAt: estimate.viewed_at ?? null,
    approvedAt: estimate.approved_at ?? null,
    approvedByName: estimate.approved_by_name ?? null,
    declinedAt: estimate.declined_at ?? null,
    declineReason: estimate.decline_reason ?? null,
    invoiceId: estimate.invoice_id ?? null,
    customerPhone: customer?.phone ?? null,
    customerEmail: customer?.email ?? null,
    emailedAt: (lastEmail as any)?.created_at ?? null,
    emailedTo: (lastEmail as any)?.email_address ?? null,
    viewCount: Number(estimate.view_count ?? 0),
    lastViewedAt: estimate.last_viewed_at ?? estimate.viewed_at ?? null,
    images: (Array.isArray(estimate.images) ? estimate.images : []).map((i: any) => ({ name: String(i?.name ?? "Image") })),
  };
}

/** Creates (or reuses) the customer approval link and saves the deposit %. */
export async function shareEstimate(
  estimateId: string,
  depositPercent: number,
): Promise<{ link: string }> {
  const { db, estimate } = await loadOwned(estimateId);
  if (estimate.invoice_id) throw new Error("This estimate is already approved.");
  const pct = Math.min(Math.max(Math.round(Number(depositPercent) || 0), 0), 100);
  const token = estimate.approval_token || newApprovalToken();

  const { error } = await db
    .from("estimates")
    .update({
      approval_token: token,
      deposit_percent: pct,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id)
    .eq("org_id", estimate.org_id);
  if (error) throw new Error("Could not create the approval link");

  revalidatePath("/estimates");
  return { link: `${await origin()}/estimate/${token}` };
}

/** Staff approval (customer said yes by phone or in person). */
export async function markEstimateAccepted(estimateId: string): Promise<{ invoiceId: string }> {
  const { org, db, estimate } = await loadOwned(estimateId);
  const result = await approveEstimateAndCreateInvoice(db, estimate, {
    name: `Marked accepted by ${org.businessName || "staff"}`,
    ip: null,
  });
  revalidatePath("/estimates");
  revalidatePath("/invoices");
  return result;
}

/** Emails the approval link (creating it first if needed). */
export async function emailEstimateToCustomer(
  estimateId: string,
  depositPercent: number,
): Promise<{ to: string; link: string }> {
  const { link } = await shareEstimate(estimateId, depositPercent);
  const { db, estimate } = await loadOwned(estimateId);
  const { sendEstimateEmail } = await import("@/lib/email/transactional");
  const { to } = await sendEstimateEmail(db, estimate.org_id, estimate as any, link);
  await markSent(db, estimate);
  return { to, link };
}

async function markSent(db: ReturnType<typeof createAdminClient>, estimate: Record<string, any>) {
  const status = String(estimate.status ?? "draft").toLowerCase();
  await db
    .from("estimates")
    .update({
      sent_at: estimate.sent_at ?? new Date().toISOString(),
      ...(status === "draft" ? { status: "sent" } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id)
    .eq("org_id", estimate.org_id);
  revalidatePath("/estimates");
}

/** The owner texted the link from their own phone: count it as sent. */
export async function markEstimateSent(estimateId: string): Promise<void> {
  const { db, estimate } = await loadOwned(estimateId);
  await markSent(db, estimate);
}

/** Remove one attached picture (by its position). */
export async function removeEstimateImage(estimateId: string, index: number): Promise<{ name: string }[]> {
  const { db, estimate } = await loadOwned(estimateId);
  const images: any[] = Array.isArray(estimate.images) ? [...estimate.images] : [];
  const [removed] = images.splice(index, 1);
  if (!removed) return images.map((i) => ({ name: String(i?.name ?? "Image") }));
  await db.from("estimates").update({ images, updated_at: new Date().toISOString() }).eq("id", estimate.id).eq("org_id", estimate.org_id);
  if (removed.path) {
    const { deletePhoto } = await import("@/lib/photo-storage");
    await deletePhoto(String(removed.path)).catch(() => undefined);
  }
  return images.map((i) => ({ name: String(i?.name ?? "Image") }));
}
