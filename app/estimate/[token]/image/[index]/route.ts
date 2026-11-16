import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { imageResponse, readImages } from "@/lib/estimates/images";

/** A picture attached to an estimate, for the customer holding the approval link. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; index: string }> }) {
  const { token, index } = await params;
  if (!token || token.length < 20) return new NextResponse("Not found", { status: 404 });
  const { data } = await createAdminClient()
    .from("estimates")
    .select("images")
    .eq("approval_token", token)
    .maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  return imageResponse(readImages(data.images), Number.parseInt(index, 10));
}
