"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOptions, type QuoteOption } from "@/lib/quotes/pricing";
import { measureAddress, type MeasureResult } from "@/lib/quotes/measure";

export interface QuoteSettingsInput {
  enabled: boolean;
  slug: string;
  pricePerFoot1Story: number;
  pricePerFoot2Story: number;
  depositPercent: number;
  tolerancePercent: number;
  minimumTotal: number;
  wreaths: QuoteOption[];
  trees: QuoteOption[];
  intro: string;
}

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

export async function saveQuoteSettings(input: QuoteSettingsInput): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Not signed in" };
  if (!["owner", "admin"].includes((org.role || "").toLowerCase())) {
    return { ok: false, error: "Only owners and admins can change quote prices" };
  }

  const slug = (input.slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  if (slug.length < 3) return { ok: false, error: "The link name needs at least 3 letters or numbers." };

  const db = createAdminClient();
  const { data: taken } = await db.from("instant_quote_settings").select("org_id").eq("slug", slug).maybeSingle();
  if (taken && taken.org_id !== org.orgId) return { ok: false, error: "That link name is taken. Try another." };

  const { error } = await db.from("instant_quote_settings").upsert(
    {
      org_id: org.orgId,
      enabled: Boolean(input.enabled),
      slug,
      price_per_foot_1_story: clamp(Number(input.pricePerFoot1Story), 0, 1000),
      price_per_foot_2_story: clamp(Number(input.pricePerFoot2Story), 0, 1000),
      deposit_percent: clamp(Number(input.depositPercent), 0, 100),
      tolerance_percent: clamp(Number(input.tolerancePercent), 0, 100),
      minimum_total: clamp(Number(input.minimumTotal), 0, 100000),
      wreaths: normalizeOptions(input.wreaths),
      trees: normalizeOptions(input.trees),
      intro: (input.intro || "").trim().slice(0, 300) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  if (error) return { ok: false, error: "Couldn't save. Please try again." };
  revalidatePath("/settings");
  revalidatePath(`/quote/${slug}`);
  return { ok: true, slug };
}

/**
 * Staff-only measurement test: runs the same satellite measurement the public
 * page uses, without creating a customer or estimate. Works while the public
 * page is switched off.
 */
export async function testMeasureAddress(
  address: string,
): Promise<{ ok: true; result: MeasureResult; solarConfigured: boolean } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Not signed in" };
  const clean = (address || "").trim().slice(0, 200);
  if (clean.length < 6) return { ok: false, error: "Enter a full street address." };
  try {
    const result = await measureAddress(clean);
    if (!result) return { ok: false, error: "Couldn't find that address." };
    return { ok: true, result, solarConfigured: Boolean(process.env.GOOGLE_SOLAR_API_KEY) };
  } catch {
    return { ok: false, error: "The measurement service didn't respond. Try again in a minute." };
  }
}
