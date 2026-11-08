import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { SQUARE_SCOPES, SQUARE_STATE_COOKIE, exchangeSquareCode, getSquareMerchantName } from "@/lib/integrations/square";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const settingsUrl = new URL("/settings?tab=integrations", request.url);
  const done = (status: string) => {
    settingsUrl.searchParams.set("square", status);
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete({ name: SQUARE_STATE_COOKIE, path: "/api/integrations/square" });
    return res;
  };

  if (params.get("error")) return done("cancelled");
  const code = params.get("code");
  const state = params.get("state") ?? "";
  const expected = request.cookies.get(SQUARE_STATE_COOKIE)?.value ?? "";
  if (!code || !state || !expected || !safeEqual(state, expected)) return done("invalid_state");

  const org = await getCurrentOrg();
  if (!org) return NextResponse.redirect(new URL("/login", request.url));
  if (state.split(".")[0] !== org.orgId) return done("invalid_state");
  if (!["owner", "admin"].includes((org.role || "").toLowerCase())) return done("forbidden");

  try {
    const tokens = await exchangeSquareCode(code, request.nextUrl.origin);
    const merchantName = await getSquareMerchantName(tokens.access_token, tokens.merchant_id);
    const { error } = await createAdminClient().from("org_integrations").upsert(
      {
        org_id: org.orgId,
        provider: "square",
        status: "connected",
        external_account_id: tokens.merchant_id,
        external_account_name: merchantName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_at,
        scopes: SQUARE_SCOPES,
        connected_by: org.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider" },
    );
    if (error) throw error;
  } catch (err) {
    console.error("[square] OAuth callback failed:", err);
    return done("error");
  }
  return done("connected");
}
