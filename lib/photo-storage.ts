import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "photos";
/** Stored photo_url values with this prefix live in Supabase Storage; anything else is a legacy Vercel Blob path. */
export const SUPABASE_PREFIX = "storage/";

export const isSupabasePhoto = (photoUrl: string) => photoUrl.startsWith(SUPABASE_PREFIX);

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "photo.jpg";
}

/** Upload an image to the private photos bucket and return the value to store in photo_url. */
export async function uploadPhoto(path: string, file: File): Promise<string> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`Photo storage upload failed: ${error.message}`);
  return `${SUPABASE_PREFIX}${path}`;
}

export async function downloadPhoto(photoUrl: string): Promise<Blob | null> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .download(photoUrl.slice(SUPABASE_PREFIX.length));
  return error ? null : data;
}

export async function deletePhoto(photoUrl: string): Promise<void> {
  if (!isSupabasePhoto(photoUrl)) {
    // Legacy Blob photo: best-effort removal; the store may be unavailable.
    const { del } = await import("@vercel/blob");
    await del(photoUrl).catch((e) => console.error("Legacy Blob delete failed:", e));
    return;
  }
  await createAdminClient().storage.from(BUCKET).remove([photoUrl.slice(SUPABASE_PREFIX.length)]);
}
