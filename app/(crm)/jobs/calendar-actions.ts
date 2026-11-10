"use server";

import { randomBytes } from "crypto";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { appBaseUrl } from "@/lib/email/transactional";

export interface CalendarFeed {
  id: string;
  crewId: string | null;
  crewName: string | null;
  url: string;
  lastFetchedAt: string | null;
}

async function requireOrg() {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not signed in.");
  return org;
}

/** The company feed (created on first use) plus any crew feeds. */
export async function getCalendarFeeds(): Promise<{ feeds: CalendarFeed[]; crews: { id: string; name: string }[] }> {
  const org = await requireOrg();
  const db = createAdminClient();
  let { data: feeds } = await db
    .from("calendar_feeds")
    .select("id, token, crew_id, last_fetched_at")
    .eq("org_id", org.orgId)
    .is("revoked_at", null)
    .order("created_at");
  if (!(feeds ?? []).some((f: any) => !f.crew_id)) {
    await db.from("calendar_feeds").insert({ org_id: org.orgId, token: randomBytes(24).toString("base64url"), created_by: org.userId });
    ({ data: feeds } = await db
      .from("calendar_feeds")
      .select("id, token, crew_id, last_fetched_at")
      .eq("org_id", org.orgId)
      .is("revoked_at", null)
      .order("created_at"));
  }
  const { data: crews } = await db.from("crews").select("id, name").eq("org_id", org.orgId).eq("active", true).order("sort_order").order("name");
  const crewName = new Map((crews ?? []).map((c: any) => [c.id, c.name]));
  const base = appBaseUrl();
  return {
    feeds: (feeds ?? []).map((f: any) => ({
      id: f.id,
      crewId: f.crew_id,
      crewName: f.crew_id ? crewName.get(f.crew_id) ?? "Crew" : null,
      url: `${base}/api/calendar/${f.token}.ics`,
      lastFetchedAt: f.last_fetched_at,
    })),
    crews: (crews ?? []).map((c: any) => ({ id: c.id, name: c.name })),
  };
}

/** A link for one crew's work orders only. */
export async function createCrewCalendarFeed(crewId: string): Promise<void> {
  const org = await requireOrg();
  const db = createAdminClient();
  const { data: crew } = await db.from("crews").select("id").eq("id", crewId).eq("org_id", org.orgId).maybeSingle();
  if (!crew) throw new Error("Crew not found.");
  const { data: existing } = await db.from("calendar_feeds").select("id").eq("org_id", org.orgId).eq("crew_id", crewId).is("revoked_at", null).maybeSingle();
  if (existing) return;
  await db.from("calendar_feeds").insert({ org_id: org.orgId, crew_id: crewId, token: randomBytes(24).toString("base64url"), created_by: org.userId });
}

/** Turns a link off (e.g. a crew member left). A new company link is made next time. */
export async function revokeCalendarFeed(feedId: string): Promise<void> {
  const org = await requireOrg();
  if (!["owner", "admin", "manager"].includes((org.role || "").toLowerCase())) throw new Error("Only owners, admins and managers can reset links.");
  await createAdminClient().from("calendar_feeds").update({ revoked_at: new Date().toISOString() }).eq("id", feedId).eq("org_id", org.orgId);
}
