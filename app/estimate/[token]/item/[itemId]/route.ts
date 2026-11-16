import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadPhoto } from "@/lib/photo-storage";

/** The small picture for one estimate item, for the customer holding the approval link. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  if (!token || token.length < 20) return new NextResponse("Not found", { status: 404 });
  const db = createAdminClient();
  const { data: est } = await db.from("estimates").select("id, org_id").eq("approval_token", token).maybeSingle();
  if (!est) return new NextResponse("Not found", { status: 404 });
  const { data: item } = await db
    .from("estimate_line_items")
    .select("image_path")
    .eq("id", itemId)
    .eq("estimate_id", est.id)
    .eq("org_id", est.org_id)
    .maybeSingle();
  if (!item?.image_path) return new NextResponse("Not found", { status: 404 });
  const file = await downloadPhoto(item.image_path);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(file.stream(), {
    headers: { "Content-Type": file.type || "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
