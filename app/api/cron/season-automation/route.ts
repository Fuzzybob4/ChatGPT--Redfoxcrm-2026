import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBusinessRules } from "@/lib/schedule-server";
import { runContractBilling, runRebookOffers } from "@/lib/season-automation";

export const maxDuration = 300;

/** Daily: contract installments, and each business's end-of-season rebook offer. */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const contracts = await runContractBilling(db);

  const { data: orgs } = await db.from("schedule_settings").select("org_id").eq("rebook_auto", true);
  const rebook: Record<string, unknown> = {};
  for (const o of orgs ?? []) {
    const rules = await loadBusinessRules(db, o.org_id);
    const r = await runRebookOffers(db, o.org_id, rules);
    if (r) rebook[o.org_id] = r;
  }
  return NextResponse.json({ contracts, rebook });
}
