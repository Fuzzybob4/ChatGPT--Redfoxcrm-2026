const MAX_DIMENSION = 1920;
const QUALITY = 0.8;
/** Images already this small and within MAX_DIMENSION are uploaded as-is. */
const SKIP_BELOW_BYTES = 300 * 1024;

/**
 * Resize a photo to at most 1920px on its longest side and re-encode it as JPEG
 * in the browser. Phone photos typically shrink from 3–5 MB to ~300–500 KB.
 * Falls back to the original file if the browser can't decode it (e.g. some HEIC).
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies EXIF rotation so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) return file;

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG has no transparency; paint white so transparent PNGs don't turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
