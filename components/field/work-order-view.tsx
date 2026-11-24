"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { setChecklistMark } from "@/app/field/actions";
import type { ChecklistMark, JobChecklist } from "@/lib/field";
import {
  AlertTriangle, Camera, ChevronDown, ClipboardList, Expand, House, Image as ImageIcon, MessageSquare,
  Wrench,
} from "lucide-react";
import { PhotoViewer } from "@/components/field/photo-viewer";
import { PhotoCapture } from "@/components/field/photo-capture";
import { FieldPhotoGallery, type FieldPhoto } from "@/components/field/field-photo-gallery";

export interface WorkArea {
  name: string;
  items: Array<{ name: string; qty: string; details: string[] }>;
}

type Tab = "install" | "notes" | "photos";

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
  checklist,
  marks: initialMarks,
  canEdit,
  notes,
  photos,
}: {
  jobId: string;
  isRemoval: boolean;
  kind: "past" | "new" | "customer_lights" | null;
  areas: WorkArea[];
  checklist: JobChecklist;
  marks: Record<string, ChecklistMark>;
  canEdit: boolean;
  notes: string;
  photos: FieldPhoto[];
}) {
  const [tab, setTab] = useState<Tab>("install");
  const [hero, setHero] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(areas.map((a) => [a.name, false])),
  );
  const viewerPhotos = photos.map((p) => ({
    src: photoSrc(p.pathname),
    caption: p.caption || "Property photo",
    date: new Date(p.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }));
  const [marks, setMarks] = useState(initialMarks);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const mark = (key: string, state: ChecklistMark["s"] | null, reason?: string) => {
    if (!canEdit) return;
    const prev = marks;
    setErr(null);
    setMarks((m) => {
      const n = { ...m };
      if (state === null) delete n[key];
      else n[key] = { s: state, reason };
      return n;
    });
    start(async () => {
      const r = await setChecklistMark(jobId, key, state, reason);
      if ("error" in r) {
        setMarks(prev);
        setErr(r.error);
      }
    });
  };
  const doneOf = (prefix: string, keys: string[]) => keys.filter((k) => marks[`${prefix}:${k}`]).length;
  const loadDone = doneOf("load", checklist.load);
  const siteDone = doneOf("site", checklist.site);
  const stepsDone = checklist.steps.filter((k) => {
    const m = marks[`step:${k}`];
    return m && (m.s === "done" || m.reason);
  }).length;
  const [cantFor, setCantFor] = useState<string | null>(null);
  const [cantReason, setCantReason] = useState("");

  const tabs: Array<{ key: Tab; label: string; Icon: typeof ClipboardList; badge?: string }> = [
    { key: "install", label: "Job", Icon: ClipboardList, badge: `${stepsDone}/${checklist.steps.length}` },
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
      <div role="tablist" className="sticky top-0 z-20 -mx-4 grid grid-cols-3 gap-1 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
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
          {err && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm font-medium text-destructive">{err}</p>}

          {/* Step 0: before leaving the shop */}
          <StepCard n={0} title="Load the truck" sub="Before you leave the shop" done={loadDone} total={checklist.load.length}
            note={kind === "past" ? "Returning customer: their lights are in a tote." : kind === "customer_lights" ? "Customer owns the lights. Bring tools, clips and cords." : kind === "new" ? "New customer: load new materials." : undefined}>
            {checklist.load.map((item) => (
              <TwoWay key={item} label={item} state={marks[`load:${item}`]?.s} yes="loaded" no="missing" yesLabel="Loaded" noLabel="Missing"
                disabled={!canEdit} onChange={(st) => mark(`load:${item}`, st)} />
            ))}
            <p className="text-xs text-muted-foreground">Start job unlocks when every item is Loaded or Missing. Missing tells the office right away.</p>
          </StepCard>

          {/* Step 1: customer-owned jobs */}
          {checklist.site.length > 0 && (
            <StepCard n={1} title="Confirm on site" sub="When you arrive" done={siteDone} total={checklist.site.length}>
              {checklist.site.map((item) => (
                <TwoWay key={item} label={item} state={marks[`site:${item}`]?.s} yes="have" no="dont" yesLabel="Have it" noLabel="Don't have it"
                  disabled={!canEdit} onChange={(st) => mark(`site:${item}`, st)} />
              ))}
            </StepCard>
          )}

          {/* Scope steps */}
          <StepCard n={checklist.site.length ? 2 : 1} title={isRemoval ? "Take it down" : "Do the work"} done={stepsDone} total={checklist.steps.length}>
            {checklist.steps.map((step) => {
              const m = marks[`step:${step}`];
              return (
                <div key={step} className="flex flex-col gap-1 border-b border-border py-2 last:border-0">
                  <div className="flex items-start gap-3">
                    <button type="button" disabled={!canEdit} aria-label={m?.s === "done" ? `Undo ${step}` : `Done: ${step}`}
                      onClick={() => mark(`step:${step}`, m?.s === "done" ? null : "done")}
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md border-2 ${m?.s === "done" ? "border-emerald-600 bg-emerald-600 text-white" : "border-border"}`}>
                      {m?.s === "done" && <Check className="size-5" />}
                    </button>
                    <span className={`flex-1 pt-1 text-[15px] leading-snug ${m?.s === "done" ? "text-muted-foreground line-through" : ""}`}>{step}</span>
                    {canEdit && m?.s !== "done" && (
                      <button type="button" className="pt-1 text-xs font-medium text-muted-foreground underline"
                        onClick={() => { setCantFor(step); setCantReason(m?.reason ?? ""); }}>
                        Can&apos;t finish
                      </button>
                    )}
                  </div>
                  {m?.s === "cant" && cantFor !== step && (
                    <p className="ml-11 text-sm text-amber-700 dark:text-amber-400">
                      Can&apos;t finish: {m.reason}{" "}
                      {canEdit && <button type="button" className="underline" onClick={() => mark(`step:${step}`, null)}>undo</button>}
                    </p>
                  )}
                  {cantFor === step && (
                    <div className="ml-11 flex gap-2">
                      <input autoFocus value={cantReason} onChange={(e) => setCantReason(e.target.value)} maxLength={300}
                        placeholder="Why? (out of clips, no outlet…)" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
                      <button type="button" className="h-10 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        disabled={!cantReason.trim()} onClick={() => { mark(`step:${step}`, "cant", cantReason.trim()); setCantFor(null); }}>
                        Save
                      </button>
                      <button type="button" aria-label="Cancel" className="h-10 px-2" onClick={() => setCantFor(null)}><X className="size-4" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </StepCard>

          {/* Before you leave */}
          <StepCard n={checklist.site.length ? 3 : 2} title="Before you leave" sub="Completion photos">
            <ul className="flex flex-col gap-1 text-[15px]">
              {checklist.photoAreas.map((a) => (
                <li key={a} className="flex items-center gap-2"><Camera className="size-4 text-muted-foreground" aria-hidden="true" />Photo: {a}</li>
              ))}
            </ul>
            {canEdit && <div className="pt-1"><PhotoCapture jobId={jobId} /></div>}
            <p className="text-xs text-muted-foreground">Complete job unlocks when every step is checked (or marked Can&apos;t finish) and there&apos;s a photo.</p>
          </StepCard>

          {areas.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details by area</h2>
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
                          <p className="text-[15px] font-semibold leading-snug">{i.name}<span className="whitespace-nowrap tabular-nums">{i.qty}</span></p>
                          {i.details.map((d, j) => <p key={j} className="text-sm leading-snug text-muted-foreground">{d}</p>)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
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

function StepCard({
  n, title, sub, done, total, note, children,
}: {
  n: number; title: string; sub?: string; done?: number; total?: number; note?: string; children: React.ReactNode;
}) {
  const complete = total != null && total > 0 && done === total;
  return (
    <section className={`flex flex-col gap-2 rounded-xl border p-4 ${complete ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${complete ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground"}`}>
          {complete ? <Check className="size-5" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold leading-tight">{title}</h2>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {total != null && total > 0 && <span className="text-xs font-semibold tabular-nums text-muted-foreground">{done}/{total}</span>}
      </div>
      {note && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{note}</p>}
      {children}
    </section>
  );
}

function TwoWay({
  label, state, yes, no, yesLabel, noLabel, disabled, onChange,
}: {
  label: string;
  state?: ChecklistMark["s"];
  yes: ChecklistMark["s"];
  no: ChecklistMark["s"];
  yesLabel: string;
  noLabel: string;
  disabled?: boolean;
  onChange: (s: ChecklistMark["s"] | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border py-1.5 last:border-0">
      <span className={`min-w-0 flex-1 text-[15px] leading-snug ${state === no ? "font-semibold text-destructive" : state === yes ? "text-muted-foreground" : ""}`}>{label}</span>
      <button type="button" disabled={disabled} onClick={() => onChange(state === yes ? null : yes)}
        className={`flex h-10 items-center gap-1 rounded-md border px-2.5 text-sm font-semibold ${state === yes ? "border-emerald-600 bg-emerald-600 text-white" : "border-border"}`}>
        <Check className="size-4" />{yesLabel}
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange(state === no ? null : no)}
        className={`flex h-10 items-center gap-1 rounded-md border px-2.5 text-sm font-semibold ${state === no ? "border-destructive bg-destructive text-white" : "border-border text-muted-foreground"}`}>
        {noLabel}
      </button>
    </div>
  );
}
