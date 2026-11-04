"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/compress-image";

export function PhotoCapture({ jobId }: { jobId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (inputRef.current) inputRef.current.value = "";
    setMessage(failed > 0 ? `${failed} photo${failed === 1 ? "" : "s"} failed to upload.` : null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        id={`photo-capture-${jobId}`}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
      />
      <label
        htmlFor={`photo-capture-${jobId}`}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground active:bg-accent"
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4 text-primary" />}
        {uploading ? "Uploading..." : "Add photo"}
      </label>
      {message && (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
