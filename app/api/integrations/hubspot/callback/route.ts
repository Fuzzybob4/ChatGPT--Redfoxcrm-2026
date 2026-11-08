import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  HUBSPOT_STATE_COOKIE,
  exchangeHubspotCode,
  getHubspotTokenInfo,
} from "@/lib/integrations/hubspot";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const settingsUrl = new URL("/settings?tab=integrations", request.url);
  const fail = (reason: string) => {
    settingsUrl.searchParams.set("hubspot", reason);
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete({ name: HUBSPOT_STATE_COOKIE, path: "/api/integrations/hubspot" });
    return res;
  };

  // The user clicked "Cancel" on HubSpot's consent screen.
  if (params.get("error")) return fail("cancelled");

  const code = params.get("code");
  const state = params.get("state") ?? "";
  const expected = request.cookies.get(HUBSPOT_STATE_COOKIE)?.value ?? "";
  if (!code || !state || !expected || !safeEqual(state, expected)) return fail("invalid_state");

  const org = await getCurrentOrg();
  if (!org) return NextResponse.redirect(new URL("/login", request.url));
  const stateOrgId = state.split(".")[0];
  if (stateOrgId !== org.orgId) return fail("invalid_state");
  if (!["owner", "admin"].includes((org.role || "").toLowerCase())) return fail("forbidden");

  try {
    const tokens = await exchangeHubspotCode(code, request.nextUrl.origin);
    const info = await getHubspotTokenInfo(tokens.access_token);

    const admin = createAdminClient();
    const { error } = await admin.from("org_integrations").upsert(
      {
        org_id: org.orgId,
        provider: "hubspot",
        status: "connected",
        external_account_id: info.hubId,
        external_account_name: info.hubDomain,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: info.scopes,
        connected_by: org.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider" },
    );
    if (error) throw error;
  } catch (err) {
    console.error("[hubspot] OAuth callback failed:", err);
    return fail("error");
  }

  settingsUrl.searchParams.set("hubspot", "connected");
  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete({ name: HUBSPOT_STATE_COOKIE, path: "/api/integrations/hubspot" });
  return res;
}
