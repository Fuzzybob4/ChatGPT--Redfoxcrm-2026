import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { downloadPhoto } from "@/lib/photo-storage";

export interface EstimateImage {
  path: string;
  name: string;
  addedAt: string;
}

export const MAX_ESTIMATE_IMAGES = 6;

export function readImages(value: unknown): EstimateImage[] {
  return (Array.isArray(value) ? value : [])
    .filter((i) => i && typeof i.path === "string")
    .map((i) => ({ path: String(i.path), name: String(i.name ?? "Image"), addedAt: String(i.addedAt ?? "") }));
}

/** True when the signed-in visitor belongs to this business (staff preview, not the customer). */
export async function isStaffOf(orgId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await createAdminClient()
      .from("user_memberships")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/** Streams one stored estimate picture. */
export async function imageResponse(images: EstimateImage[], index: number) {
  const img = images[index];
  if (!img) return new NextResponse("Not found", { status: 404 });
  const file = await downloadPhoto(img.path);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(file.stream(), {
    headers: {
      "Content-Type": file.type || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
