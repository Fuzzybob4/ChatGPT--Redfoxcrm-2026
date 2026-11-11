"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordTermsAcceptance } from "@/lib/legal-server";

/** The business owner accepts the current Terms of Service and Privacy Policy. */
export async function acceptTerms(): Promise<{ ok: true } | { error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { error: "Not signed in." };
  if (!["owner", "admin"].includes(org.role)) return { error: "Only the business owner can accept the terms." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const h = await headers();
  await recordTermsAcceptance(createAdminClient(), org.orgId, user.id, {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    userAgent: h.get("user-agent"),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
