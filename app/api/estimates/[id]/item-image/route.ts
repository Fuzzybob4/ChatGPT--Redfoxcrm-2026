import { type NextRequest, NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadPhoto, safeFileName, uploadPhoto } from "@/lib/photo-storage";
import { uploadErrorResponse } from "@/lib/upload-error";

async function owned(id: string) {
  const org = await getCurrentOrg();
  if (!org) return null;
  const { data } = await createAdminClient().from("estimates").select("id, org_id").eq("id", id).eq("org_id", org.orgId).maybeSingle();
  return data;
}

const prefixFor = (orgId: string, id: string) => `storage/estimates/${orgId}/${id}/items/`;

/** Staff preview of an item picture: /api/estimates/<id>/item-image?path=storage/... */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const est = await owned(id);
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!est || !path.startsWith(prefixFor(est.org_id, id))) return new NextResponse("Not found", { status: 404 });
  const file = await downloadPhoto(path);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(file.stream(), {
    headers: { "Content-Type": file.type || "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}

/** Upload a picture for one item. Returns the stored path; it's saved with the item when the estimate is saved. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const est = await owned(id);
    if (!est) return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only images can be added" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Images must be under 10MB" }, { status: 400 });
    const path = await uploadPhoto(
      `estimates/${est.org_id}/${id}/items/${Date.now()}-${safeFileName(file.name)}`,
      file,
    );
    return NextResponse.json({ path });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
