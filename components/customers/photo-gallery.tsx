"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, User, Wrench } from "lucide-react";
import { PhotoViewer } from "@/components/field/photo-viewer";

export interface GalleryPhoto {
  id: string;
  src: string;
  customerId: string | null;
  customerName: string;
  place: string;
  caption: string;
  takenBy: string | null;
  takenAt: string;
}

const RANGE_LABEL: Record<string, string> = { "7": "7 days", "30": "30 days", "90": "90 days", all: "All" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Scan the crews' photos; tap one to go to the customer or book a service call. */
export function PhotoGallery({
  photos, range, q, page, hasMore,
}: {
  photos: GalleryPhoto[]; range: string; q: string; page: number; hasMore: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState(q);
  const url = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ range, ...(q ? { q } : {}), page: String(page), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    if (p.get("page") === "0") p.delete("page");
    if (!p.get("q")) p.delete("q");
    return `/customers/photos?${p.toString()}`;
  };

  // Group by day so it reads like a camera roll.
  const groups: Array<{ label: string; items: Array<{ p: GalleryPhoto; i: number }> }> = [];
  photos.forEach((p, i) => {
    const label = day(p.takenAt);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push({ p, i });
    else groups.push({ label, items: [{ p, i }] });
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form className="relative min-w-0 flex-1 sm:max-w-sm" onSubmit={(e) => { e.preventDefault(); router.push(url({ q: search.trim(), page: 0 })); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or street"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-base md:text-sm" />
        </form>
        <div className="flex rounded-lg border border-border bg-muted p-0.5 text-sm font-medium">
          {Object.keys(RANGE_LABEL).map((r) => (
            <Link key={r} href={url({ range: r, page: 0 })}
              className={`rounded-md px-3 py-1.5 ${r === range ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              {RANGE_LABEL[r]}
            </Link>
          ))}
        </div>
      </div>

      {photos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No photos {q ? `for "${q}"` : ""} in this time range.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {g.items.map(({ p, i }) => (
                <button key={p.id} type="button" onClick={() => setOpen(i)}
                  className="group relative overflow-hidden rounded-lg bg-muted text-left">
                  <img src={p.src} alt={p.caption || `Photo of ${p.customerName}`} loading="lazy"
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-white">
                    <span className="block truncate text-sm font-semibold">{p.customerName}</span>
                    <span className="block truncate text-[11px] opacity-80">{p.place || p.caption}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {(page > 0 || hasMore) && (
        <div className="flex justify-center gap-2">
          {page > 0 && <Link href={url({ page: page - 1 })} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">‹ Newer</Link>}
          {hasMore && <Link href={url({ page: page + 1 })} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Older ›</Link>}
        </div>
      )}

      {open != null && (
        <PhotoViewer
          photos={photos.map((p) => ({
            src: p.src,
            caption: `${p.customerName}${p.caption ? ` · ${p.caption}` : ""}`,
            date: `${day(p.takenAt)}${p.takenBy ? ` · by ${p.takenBy}` : ""}`,
          }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          footer={(i) => {
            const p = photos[i];
            if (!p?.customerId) return null;
            return (
              <>
                <Link href={`/customers/${p.customerId}`}
                  className="flex h-11 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-black">
                  <User className="size-4" /> Open customer
                </Link>
                <Link href={`/jobs/new?customer=${p.customerId}&type=other&title=${encodeURIComponent("Service call: ")}`}
                  className="flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  <Wrench className="size-4" /> Schedule service call
                </Link>
              </>
            );
          }}
        />
      )}
    </div>
  );
}
