"use client";

import { useState } from "react";
import { PhotoViewer } from "@/components/field/photo-viewer";

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

      {index != null && (
        <PhotoViewer
          photos={photos.map((p) => ({
            src: photoSrc(p.pathname),
            caption: p.caption || "Install photo",
            date: new Date(p.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          }))}
          index={index}
          onIndex={setIndex}
          onClose={() => setIndex(null)}
        />
      )}
    </>
  );
}
