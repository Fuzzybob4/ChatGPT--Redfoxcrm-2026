import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentOrg } from "@/lib/org";
import {
  HUBSPOT_STATE_COOKIE,
  hubspotAuthorizeUrl,
  hubspotConfigured,
} from "@/lib/integrations/hubspot";

const MANAGER_ROLES = ["owner", "admin"];

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings?tab=integrations", request.url);

  const org = await getCurrentOrg();
  if (!org) return NextResponse.redirect(new URL("/login", request.url));

  if (!MANAGER_ROLES.includes((org.role || "").toLowerCase())) {
    settingsUrl.searchParams.set("hubspot", "forbidden");
    return NextResponse.redirect(settingsUrl);
  }
  if (!hubspotConfigured()) {
    settingsUrl.searchParams.set("hubspot", "not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  // State ties the HubSpot callback back to this user's org and prevents CSRF.
  const nonce = randomBytes(24).toString("hex");
  const state = `${org.orgId}.${nonce}`;

  const response = NextResponse.redirect(hubspotAuthorizeUrl(request.nextUrl.origin, state));
  response.cookies.set(HUBSPOT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/integrations/hubspot",
    maxAge: 600,
  });
  return response;
}
