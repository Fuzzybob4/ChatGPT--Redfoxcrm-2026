"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { OFFICE_ROLES } from "@/lib/field";

async function ctx(id: string) {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not signed in.");
  if (!OFFICE_ROLES.includes(String(org.role ?? "").toLowerCase())) throw new Error("Only owners, admins and managers can do that.");
  const db = createAdminClient();
  const { data: est } = await db
    .from("estimates")
    .select("id, org_id, invoice_id, images")
    .eq("id", id)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!est) throw new Error("Estimate not found.");
  return { db, est, orgId: org.orgId };
}

/** Hide (or bring back) an estimate. Nothing is lost; the customer's link stops working while archived. */
export async function setEstimateArchived(id: string, archived: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { db, est, orgId } = await ctx(id);
    await db
      .from("estimates")
      .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", est.id)
      .eq("org_id", orgId);
    revalidatePath("/estimates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't update the estimate." };
  }
}

/**
 * Delete an estimate for good. Not allowed once it's approved (it has an
 * invoice and payment history); archive those instead.
 */
export async function deleteEstimate(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { db, est, orgId } = await ctx(id);
    if (est.invoice_id) return { ok: false, error: "This estimate was approved and has an invoice. Archive it instead." };

    const { data: items } = await db.from("estimate_line_items").select("image_path").eq("estimate_id", est.id).eq("org_id", orgId);
    await db.from("estimate_line_items").delete().eq("estimate_id", est.id).eq("org_id", orgId);
    const { error } = await db.from("estimates").delete().eq("id", est.id).eq("org_id", orgId);
    if (error) return { ok: false, error: "Couldn't delete the estimate. Try archiving it instead." };

    // Clean up its pictures (best effort).
    const { deletePhoto } = await import("@/lib/photo-storage");
    const paths = [
      ...(Array.isArray(est.images) ? est.images.map((i: any) => i?.path) : []),
      ...(items ?? []).map((i) => i.image_path),
    ].filter((p): p is string => typeof p === "string" && p.length > 0);
    await Promise.all(paths.map((p) => deletePhoto(p).catch(() => undefined)));

    revalidatePath("/estimates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete the estimate." };
  }
}
