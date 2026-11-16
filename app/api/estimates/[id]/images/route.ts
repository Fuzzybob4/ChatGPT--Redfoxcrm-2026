import { type NextRequest, NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeFileName, uploadPhoto } from "@/lib/photo-storage";
import { uploadErrorResponse } from "@/lib/upload-error";
import { MAX_ESTIMATE_IMAGES, imageResponse, readImages } from "@/lib/estimates/images";

async function load(id: string) {
  const org = await getCurrentOrg();
  if (!org) return null;
  const db = createAdminClient();
  const { data } = await db.from("estimates").select("id, org_id, images").eq("id", id).eq("org_id", org.orgId).maybeSingle();
  return data ? { db, estimate: data } : null;
}

/** Staff view of an attached picture: /api/estimates/<id>/images?i=0 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await load(id);
  if (!ctx) return new NextResponse("Not found", { status: 404 });
  return imageResponse(readImages(ctx.estimate.images), Number.parseInt(req.nextUrl.searchParams.get("i") ?? "0", 10));
}

/** Attach a picture (e.g. a mockup of the lit-up home) to an estimate. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await load(id);
    if (!ctx) return NextResponse.json({ error: "Estimate not found" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only images can be attached" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Images must be under 10MB" }, { status: 400 });

    const images = readImages(ctx.estimate.images);
    if (images.length >= MAX_ESTIMATE_IMAGES) {
      return NextResponse.json({ error: `Up to ${MAX_ESTIMATE_IMAGES} images per estimate` }, { status: 400 });
    }

    const path = await uploadPhoto(
      `estimates/${ctx.estimate.org_id}/${id}/${Date.now()}-${safeFileName(file.name)}`,
      file,
    );
    const next = [...images, { path, name: file.name || "Image", addedAt: new Date().toISOString() }];
    const { error } = await ctx.db
      .from("estimates")
      .update({ images: next, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.estimate.org_id);
    if (error) return NextResponse.json({ error: "Could not save the image" }, { status: 500 });
    return NextResponse.json({ images: next.map((i) => ({ name: i.name })) });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
