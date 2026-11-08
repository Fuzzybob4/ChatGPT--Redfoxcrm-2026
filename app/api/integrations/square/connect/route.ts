import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentOrg } from "@/lib/org";
import { SQUARE_STATE_COOKIE, squareAuthorizeUrl, squareConfigured } from "@/lib/integrations/square";

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings?tab=integrations", request.url);
  const org = await getCurrentOrg();
  if (!org) return NextResponse.redirect(new URL("/login", request.url));
  if (!["owner", "admin"].includes((org.role || "").toLowerCase())) {
    settingsUrl.searchParams.set("square", "forbidden");
    return NextResponse.redirect(settingsUrl);
  }
  if (!squareConfigured()) {
    settingsUrl.searchParams.set("square", "not_configured");
    return NextResponse.redirect(settingsUrl);
  }
  const state = `${org.orgId}.${randomBytes(24).toString("hex")}`;
  const response = NextResponse.redirect(squareAuthorizeUrl(request.nextUrl.origin, state));
  response.cookies.set(SQUARE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/integrations/square",
    maxAge: 600,
  });
  return response;
}
