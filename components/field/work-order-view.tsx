"use client";

import { useState } from "react";
import {
  AlertTriangle, Box, Camera, ChevronDown, ClipboardList, Expand, House, Image as ImageIcon, MessageSquare,
  Package, Sparkles, Wrench,
} from "lucide-react";
import { PhotoViewer } from "@/components/field/photo-viewer";
import { MaterialsChecklist } from "@/components/field/materials-checklist";
import { PhotoCapture } from "@/components/field/photo-capture";
import { FieldPhotoGallery, type FieldPhoto } from "@/components/field/field-photo-gallery";

export interface WorkArea {
  name: string;
  items: Array<{ name: string; qty: string; details: string[] }>;
}

type Tab = "install" | "materials" | "notes" | "photos";

const photoSrc = (pathname: string) => `/api/file/photo?pathname=${encodeURIComponent(pathname)}`;

/**
 * The crew's work order: photos first, then what to install (grouped by
 * area), what to load, the notes, and every photo. No prices anywhere.
 */
export function WorkOrderView({
  jobId,
  isRemoval,
  kind,
  areas,
  loadOut,
  checked,
  canEdit,
  notes,
  photos,
}: {
  jobId: string;
  isRemoval: boolean;
  kind: "past" | "new" | "customer_lights" | null;
  areas: WorkArea[];
  loadOut: string[];
  checked: Record<string, string>;
  canEdit: boolean;
  notes: string;
  photos: FieldPhoto[];
}) {
  const [tab, setTab] = useState<Tab>("install");
  const [hero, setHero] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(areas.map((a, i) => [a.name, i === 0 || areas.length <= 2])),
  );
  const viewerPhotos = photos.map((p) => ({
    src: photoSrc(p.pathname),
    caption: p.caption || "Property photo",
    date: new Date(p.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }));
  const loadedCount = loadOut.filter((i) => checked[i]).length;

  const steps: string[] = isRemoval
    ? [
        "Check the install photos so you know everything that went up.",
        ...areas.flatMap((a) => a.items.map((i) => `Take down ${i.name.toLowerCase()}${i.qty}.`)),
        "Label each set by area (roofline, trees, etc.) and pack it in the customer's tote.",
        "Pick up clips, stakes and cords, and leave the property clean.",
        "Take a photo of the packed totes before you leave.",
      ]
    : [
        kind === "past"
          ? "Pull the customer's tote and check it against the Materials tab."
          : kind === "customer_lights"
            ? "Find the customer's lights on site and test them before hanging."
            : "Load new materials from the Materials tab.",
        ...areas.flatMap((a) => a.items.map((i) => `Install ${i.name}${i.qty}.`)),
        "Check for clean, straight lines and secure every connection.",
        "Turn everything on, test it, and take completion photos.",
      ];

  const tabs: Array<{ key: Tab; label: string; Icon: typeof ClipboardList; badge?: string }> = [
    { key: "install", label: isRemoval ? "Removal" : "Install", Icon: ClipboardList },
    { key: "materials", label: "Materials", Icon: Package, badge: loadOut.length ? `${loadedCount}/${loadOut.length}` : undefined },
    { key: "notes", label: "Notes", Icon: MessageSquare, badge: notes ? "•" : undefined },
    { key: "photos", label: "Photos", Icon: Camera, badge: photos.length ? String(photos.length) : undefined },
  ];

  return (
    <>
      {/* Photo hero: the house first */}
      {photos.length > 0 ? (
        <section aria-label="Property photos" className="flex flex-col gap-2">
          <button type="button" onClick={() => setViewer(hero)} className="relative block w-full overflow-hidden rounded-xl bg-muted">
            <img src={photoSrc(photos[hero].pathname)} alt={photos[hero].caption || "Property photo"} className="aspect-[4/3] w-full object-cover" />
            <span className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-lg bg-black/60 text-white">
              <Expand className="size-5" aria-hidden="true" />
            </span>
            <span className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
              <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {hero + 1} of {photos.length}
                {photos[hero].caption ? ` – ${photos[hero].caption}` : ""}
              </span>
            </span>
          </button>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.slice(0, 12).map((p, i) => (
                <button key={p.id} type="button" onClick={() => setHero(i)} aria-label={`Show photo ${i + 1}`}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === hero ? "border-primary" : "border-transparent"}`}>
                  <img src={photoSrc(p.pathname)} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <House className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No photos of this house yet. Take one so next season&apos;s crew knows the setup.</p>
          {canEdit && <PhotoCapture jobId={jobId} />}
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" className="sticky top-0 z-20 -mx-4 grid grid-cols-4 gap-1 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        {tabs.map(({ key, label, Icon, badge }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold ${
              tab === key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}>
            <span className="flex items-center gap-1">
              <Icon className="size-4" aria-hidden="true" />
              {badge && <span className="tabular-nums text-[10px] font-medium opacity-90">{badge}</span>}
            </span>
            {label}
          </button>
        ))}
      </div>

      {tab === "install" && (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <ClipboardList className="size-5 text-primary" aria-hidden="true" />
              {isRemoval ? "Removal steps" : "Installation steps"}
            </h2>
            <ol className="flex flex-col gap-2.5">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                  <span className="pt-0.5 text-[15px] leading-snug">{s}</span>
                </li>
              ))}
            </ol>
          </section>

          {areas.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isRemoval ? "What's coming down" : "What we're installing"}, by area
              </h2>
              {areas.map((a) => (
                <div key={a.name} className="overflow-hidden rounded-xl border border-border bg-card">
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [a.name]: !o[a.name] }))}
                    className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left">
                    <span className="flex items-center gap-2 font-semibold">
                      <Wrench className="size-4 text-primary" aria-hidden="true" />
                      {a.name}
                      <span className="text-xs font-normal text-muted-foreground">{a.items.length} item{a.items.length === 1 ? "" : "s"}</span>
                    </span>
                    <ChevronDown className={`size-5 transition-transform ${open[a.name] ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {open[a.name] && (
                    <ul className="flex flex-col divide-y divide-border border-t border-border px-4">
                      {a.items.map((i, idx) => (
                        <li key={idx} className="py-2.5">
                          <p className="text-[15px] font-semibold leading-snug">
                            {i.name}
                            <span className="whitespace-nowrap tabular-nums">{i.qty}</span>
                          </p>
                          {i.details.map((d, j) => (
                            <p key={j} className="text-sm leading-snug text-muted-foreground">{d}</p>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              The office hasn&apos;t listed the items yet. Check Notes and Photos, or call the office.
            </p>
          )}

          {notes && (
            <button type="button" onClick={() => setTab("notes")}
              className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left dark:border-amber-800 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-semibold">Special instructions</span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{notes}</span>
              </span>
            </button>
          )}
        </div>
      )}

      {tab === "materials" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm">
            {kind === "past" ? <Box className="size-4 shrink-0 text-emerald-600" /> : kind === "customer_lights" ? <House className="size-4 shrink-0 text-violet-600" /> : <Sparkles className="size-4 shrink-0 text-orange-600" />}
            {kind === "past"
              ? "Returning customer: their lights are in a tote at the shop."
              : kind === "customer_lights"
                ? "Customer owns the lights. Bring ladders and tools."
                : "New customer: load new materials for this job."}
          </p>
          {loadOut.length ? (
            <MaterialsChecklist jobId={jobId} items={loadOut} checked={checked} canEdit={canEdit} />
          ) : (
            <p className="text-sm text-muted-foreground">No materials listed.</p>
          )}
          <p className="text-xs text-muted-foreground">Check items off as you load the truck. The whole crew sees the same list.</p>
        </div>
      )}

      {tab === "notes" && (
        <section className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <h2 className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
            Notes &amp; special instructions
          </h2>
          {notes ? (
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes from the office for this job.</p>
          )}
          <p className="text-xs text-muted-foreground">Contact the office if anything doesn&apos;t match, or there&apos;s an issue with power or access.</p>
        </section>
      )}

      {tab === "photos" && (
        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {photos.length ? "This property, newest first. Tap to view full screen." : "No photos yet."}
            </p>
            {canEdit && <PhotoCapture jobId={jobId} />}
          </div>
          <FieldPhotoGallery photos={photos} />
        </section>
      )}

      {viewer != null && <PhotoViewer photos={viewerPhotos} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </>
  );
}
