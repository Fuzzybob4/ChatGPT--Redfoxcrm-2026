"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Check, Images, Loader2, RotateCw, X } from "lucide-react";
import { compressImage } from "@/lib/compress-image";

const TAGS = ["Before", "After", "Roofline", "Windows", "Door", "Trees", "Wreath", "Garland", "Bushes", "Issue / damage"];

interface Shot {
  key: string;
  file: File;
  preview: string;
  status: "uploading" | "saved" | "failed";
  id?: string;
  table?: string;
  tags: string[];
  note: string;
  savedText?: string;
}

const describe = (s: Pick<Shot, "tags" | "note">) =>
  [s.tags.join(", "), s.note.trim()].filter(Boolean).join(": ");

/**
 * Fast photo capture, CompanyCam style: snap or pick several photos, they
 * upload right away in the background, and each gets one-tap tags plus an
 * optional note. Notes save as you go.
 */
export function PhotoCapture({ jobId }: { jobId: string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [shots, setShots] = useState<Shot[]>([]);
  const [open, setOpen] = useState(false);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  const patch = (key: string, fields: Partial<Shot>) =>
    setShots((list) => list.map((s) => (s.key === key ? { ...s, ...fields } : s)));

  const upload = async (shot: Shot) => {
    patch(shot.key, { status: "uploading" });
    try {
      const body = new FormData();
      body.append("file", await compressImage(shot.file));
      body.append("jobId", jobId);
      const current = shotsRef.current.find((s) => s.key === shot.key) ?? shot;
      const text = describe(current);
      if (text) body.append("description", text);
      const res = await fetch("/api/field/photo", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) throw new Error();
      patch(shot.key, { status: "saved", id: json.id, table: json.table, savedText: text });
    } catch {
      patch(shot.key, { status: "failed" });
    }
  };

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const next: Shot[] = Array.from(files).map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      status: "uploading",
      tags: [],
      note: "",
    }));
    setShots((list) => [...next, ...list]);
    setOpen(true);
    next.forEach((s) => void upload(s));
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  };

  // Save tags/notes a moment after they stop typing.
  useEffect(() => {
    const t = setTimeout(() => {
      for (const s of shotsRef.current) {
        const text = describe(s);
        if (s.status === "saved" && s.id && text !== (s.savedText ?? "")) {
          patch(s.key, { savedText: text });
          void fetch("/api/field/photo", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: s.id, table: s.table, description: text }),
          });
        }
      }
    }, 700);
    return () => clearTimeout(t);
  }, [shots]);

  const uploading = shots.filter((s) => s.status === "uploading").length;
  const failed = shots.filter((s) => s.status === "failed").length;

  const close = () => {
    if (uploading && !confirm("Photos are still uploading. Close anyway? They'll keep uploading only while this page is open.")) return;
    // Flush any unsaved notes before closing.
    for (const s of shotsRef.current) {
      const text = describe(s);
      if (s.status === "saved" && s.id && text !== (s.savedText ?? "")) {
        void fetch("/api/field/photo", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: s.id, table: s.table, description: text }),
        });
      }
    }
    shots.forEach((s) => URL.revokeObjectURL(s.preview));
    setShots([]);
    setOpen(false);
    router.refresh();
  };

  const btn =
    "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground active:bg-accent";

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only"
        id={`photo-camera-${jobId}`} onChange={(e) => add(e.target.files)} />
      <input ref={libraryRef} type="file" accept="image/*" multiple className="sr-only"
        id={`photo-library-${jobId}`} onChange={(e) => add(e.target.files)} />
    </>
  );

  return (
    <div className="flex flex-col items-end gap-1">
      {inputs}
      <div className="flex flex-wrap justify-end gap-2">
        <label htmlFor={`photo-camera-${jobId}`} className={btn}>
          <Camera className="size-4 text-primary" /> Take photos
        </label>
        <label htmlFor={`photo-library-${jobId}`} className={btn}>
          <Images className="size-4 text-primary" /> Choose photos
        </label>
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Photos for this job">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div>
                <p className="font-semibold">{shots.length} photo{shots.length === 1 ? "" : "s"}</p>
                <p className="text-xs text-muted-foreground">
                  {uploading ? `Uploading ${uploading}…` : failed ? `${failed} failed. Tap retry.` : "All saved. Tag them, then Done."}
                </p>
              </div>
              <button type="button" onClick={close}
                className="flex h-11 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                <Check className="size-4" /> Done
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <ul className="flex flex-col gap-3">
                {shots.map((s) => (
                  <li key={s.key} className="flex gap-3 rounded-xl border border-border bg-card p-2">
                    <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img src={s.preview} alt="" className="size-full object-cover" />
                      <span className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
                        {s.status === "uploading" ? <Loader2 className="size-3.5 animate-spin" />
                          : s.status === "saved" ? <Check className="size-3.5" />
                          : <AlertCircle className="size-3.5 text-red-300" />}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap gap-1">
                        {TAGS.map((t) => {
                          const on = s.tags.includes(t);
                          return (
                            <button key={t} type="button"
                              onClick={() => patch(s.key, { tags: on ? s.tags.filter((x) => x !== t) : [...s.tags, t] })}
                              className={`rounded-full border px-2 py-1 text-xs font-medium ${
                                on ? (t.startsWith("Issue") ? "border-destructive bg-destructive text-white" : "border-primary bg-primary text-primary-foreground") : "border-border"
                              }`}>
                              {t}
                            </button>
                          );
                        })}
                      </div>
                      <input value={s.note} onChange={(e) => patch(s.key, { note: e.target.value })} maxLength={300}
                        placeholder="Add a note (optional)"
                        className="h-10 w-full rounded-md border border-input bg-background px-2 text-base" />
                      {s.status === "failed" && (
                        <button type="button" onClick={() => upload(s)} className="flex items-center gap-1 self-start text-xs font-semibold text-destructive">
                          <RotateCw className="size-3.5" /> Upload failed. Retry
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <label htmlFor={`photo-camera-${jobId}`} className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground">
                <Camera className="size-5" /> Take another
              </label>
              <label htmlFor={`photo-library-${jobId}`} className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border text-base font-semibold">
                <Images className="size-5" /> Add from library
              </label>
            </div>
            <button type="button" onClick={close} aria-label="Close" className="sr-only"><X /></button>
          </div>,
          document.body,
        )}
    </div>
  );
}
