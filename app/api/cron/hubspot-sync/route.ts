import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHubspotSync } from "@/lib/integrations/hubspot-sync";

export const maxDuration = 300;

/** Nightly safety net: incremental HubSpot sync for every connected business. */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: rows, error } = await db.from("org_integrations").select("org_id").eq("provider", "hubspot");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const started = Date.now();
  const results: Array<{ orgId: string; ok: boolean; created?: number; skippedLocked?: boolean }> = [];
  for (const row of rows ?? []) {
    if (Date.now() - started > 240_000) break;
    try {
      const summary = await runHubspotSync(row.org_id, { mode: "incremental", geocodeBudgetMs: 30_000 });
      results.push({ orgId: row.org_id, ok: true, created: summary?.created, skippedLocked: !summary });
    } catch (err) {
      console.error("[cron] hubspot sync failed for org", row.org_id, err);
      results.push({ orgId: row.org_id, ok: false });
    }
  }
  return NextResponse.json({ synced: results.length, results });
}
