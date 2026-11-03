"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface FieldPhoto {
  id: string;
  pathname: string;
  caption: string;
  takenAt: string;
}

const photoSrc = (pathname: string) => `/api/file/photo?pathname=${encodeURIComponent(pathname)}`;

export function FieldPhotoGallery({ photos }: { photos: FieldPhoto[] }) {
  const [index, setIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Photos you take on this job will show here for next season.
      </div>
    );
  }

  const current = index != null ? photos[index] : null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="block aspect-square w-full overflow-hidden rounded-lg bg-muted"
              aria-label={`Open photo ${i + 1}${photo.caption ? `: ${photo.caption}` : ""}`}
            >
              <img
                src={photoSrc(photo.pathname)}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={current != null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent showCloseButton={false} className="max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {current && index != null && (
            <div className="flex flex-col">
              <DialogTitle className="sr-only">Photo {index + 1} of {photos.length}</DialogTitle>
              <div className="relative bg-foreground">
                <img
                  src={photoSrc(current.pathname)}
                  alt={current.caption || `Install photo ${index + 1}`}
                  className="max-h-[70dvh] w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setIndex(null)}
                  className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full bg-background/90 text-foreground"
                  aria-label="Close photo"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setIndex((index - 1 + photos.length) % photos.length)}
                  className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-accent"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <div className="min-w-0 text-center">
                  <p className="truncate text-sm text-foreground">{current.caption || "Install photo"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(current.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {" · "}
                    {index + 1}/{photos.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIndex((index + 1) % photos.length)}
                  className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-accent"
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
