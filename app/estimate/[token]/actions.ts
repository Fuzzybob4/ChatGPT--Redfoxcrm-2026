"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ESTIMATE_COLUMNS,
  approveEstimateAndCreateInvoice,
  ensurePortalToken,
  type EstimateRow,
} from "@/lib/estimates/approval";

async function loadByToken(token: string) {
  if (!token || token.length < 20) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("estimates")
    .select(ESTIMATE_COLUMNS + ", declined_at, valid_until")
    .eq("approval_token", token)
    .maybeSingle();
  return data ? { db, estimate: data as unknown as EstimateRow & { declined_at: string | null; valid_until: string | null } } : null;
}

export async function approveEstimate(
  token: string,
  input: { name: string; agreed: boolean },
): Promise<{ ok: true; portalUrl: string; hasDeposit: boolean } | { ok: false; error: string }> {
  const name = (input.name ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Please type your full name to sign." };
  if (!input.agreed) return { ok: false, error: "Please check the box to agree to the estimate." };

  const found = await loadByToken(token);
  if (!found) return { ok: false, error: "This estimate link is no longer valid." };
  const { db, estimate } = found;
  if (estimate.declined_at) return { ok: false, error: "This estimate was declined. Please contact the business." };
  if (estimate.valid_until && !estimate.invoice_id && new Date(estimate.valid_until + "T23:59:59") < new Date()) {
    return { ok: false, error: "This estimate has expired. Please contact the business for an updated one." };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  try {
    await approveEstimateAndCreateInvoice(db, estimate, { name, ip });
    const portalToken = await ensurePortalToken(db, estimate.customer_id, estimate.org_id);
    return {
      ok: true,
      portalUrl: `/customer-portal/${encodeURIComponent(portalToken)}`,
      hasDeposit: Number(estimate.deposit_percent ?? 0) > 0,
    };
  } catch (err) {
    console.error("[estimate] approval failed:", err);
    return { ok: false, error: "Something went wrong saving your approval. Please try again." };
  }
}

export async function declineEstimate(
  token: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const found = await loadByToken(token);
  if (!found) return { ok: false, error: "This estimate link is no longer valid." };
  const { db, estimate } = found;
  if (estimate.invoice_id) return { ok: false, error: "This estimate was already approved." };

  const { error } = await db
    .from("estimates")
    .update({
      status: "rejected",
      declined_at: new Date().toISOString(),
      decline_reason: (reason ?? "").trim().slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id)
    .eq("org_id", estimate.org_id);
  if (error) return { ok: false, error: "Could not save your response. Please try again." };
  return { ok: true };
}
