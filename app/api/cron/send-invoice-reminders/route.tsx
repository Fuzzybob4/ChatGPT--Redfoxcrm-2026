import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured } from "@/lib/email/resend";
import { sendInvoiceEmail, type TransactionalKind } from "@/lib/email/transactional";

export const maxDuration = 300;

/**
 * Daily friendly payment reminders.
 *
 * For each business with reminders on (organizations.invoice_reminders_enabled),
 * unpaid invoices sent on or after REMINDERS_START get:
 *   - due_soon   3 days before the due date
 *   - overdue_1  1 day after the due date
 *   - overdue_2  8 days after
 *   - overdue_3  15 days after (last one)
 * Each kind goes out at most once per invoice (unique index on the log).
 * Customers who opted out, or with no email, are skipped.
 */
const REMINDERS_START = "2026-11-08";
const DAY = 24 * 60 * 60 * 1000;

function dueKind(dueDate: string, now: Date): TransactionalKind | null {
  const due = new Date(`${dueDate}T12:00:00`).getTime();
  const days = Math.floor((now.getTime() - due) / DAY);
  if (days >= -3 && days < 0) return "due_soon";
  if (days >= 15) return "overdue_3";
  if (days >= 8) return "overdue_2";
  if (days >= 1) return "overdue_1";
  return null;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ skipped: "RESEND_API_KEY is not set" });
  }

  const db = createAdminClient();
  const now = new Date();
  const started = Date.now();

  const { data: orgs } = await db.from("organizations").select("id").eq("invoice_reminders_enabled", true);
  const orgIds = (orgs ?? []).map((o) => o.id);
  if (orgIds.length === 0) return NextResponse.json({ sent: 0 });

  const { data: invoices, error } = await db
    .from("invoices")
    .select("id, org_id, due_date, total_amount, amount_paid, status")
    .in("org_id", orgIds)
    .in("status", ["sent", "viewed", "overdue"])
    .not("due_date", "is", null)
    .gte("sent_at", REMINDERS_START)
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = (invoices ?? [])
    .map((i) => ({ ...i, kind: dueKind(i.due_date as string, now) }))
    .filter((i) => i.kind && Number(i.total_amount ?? 0) - Number(i.amount_paid ?? 0) > 0.005);

  const ids = candidates.map((c) => c.id);
  const { data: already } = ids.length
    ? await db.from("invoice_reminder_log").select("invoice_id, kind").in("invoice_id", ids).eq("status", "sent")
    : { data: [] as Array<{ invoice_id: string; kind: string }> };
  const done = new Set((already ?? []).map((r) => `${r.invoice_id}:${r.kind}`));

  const results = { sent: 0, skipped: 0, failed: 0 };
  for (const inv of candidates) {
    if (Date.now() - started > 240_000) break;
    const key = `${inv.id}:${inv.kind}`;
    if (done.has(key)) { results.skipped++; continue; }
    try {
      await sendInvoiceEmail(db, inv.org_id, inv.id, inv.kind as Exclude<TransactionalKind, "estimate_sent">);
      results.sent++;
      if (inv.kind?.startsWith("overdue") && inv.status !== "overdue") {
        await db.from("invoices").update({ status: "overdue" }).eq("id", inv.id).eq("org_id", inv.org_id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("no email") || message.includes("turned off")) results.skipped++;
      else results.failed++;
    }
  }

  return NextResponse.json(results);
}
