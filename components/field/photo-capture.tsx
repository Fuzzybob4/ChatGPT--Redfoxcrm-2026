"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Images, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/compress-image";

export function PhotoCapture({ jobId }: { jobId: string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage(null);
    let failed = 0;
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", await compressImage(file));
      body.append("jobId", jobId);
      const res = await fetch("/api/field/photo", { method: "POST", body });
      if (!res.ok) failed += 1;
    }
    setUploading(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
    setMessage(failed > 0 ? `${failed} photo${failed === 1 ? "" : "s"} failed to upload.` : null);
    router.refresh();
  }

  const btn =
    "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground active:bg-accent";

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Camera: opens the camera directly. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        id={`photo-camera-${jobId}`}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
      />
      {/* Library: no capture attribute, so phones offer the photo library. */}
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        id={`photo-library-${jobId}`}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
      />
      {uploading ? (
        <span className={btn}>
          <Loader2 className="size-4 animate-spin" />
          Uploading...
        </span>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <label htmlFor={`photo-camera-${jobId}`} className={btn}>
            <Camera className="size-4 text-primary" />
            Take photo
          </label>
          <label htmlFor={`photo-library-${jobId}`} className={btn}>
            <Images className="size-4 text-primary" />
            Choose photos
          </label>
        </div>
      )}
      {message && (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
