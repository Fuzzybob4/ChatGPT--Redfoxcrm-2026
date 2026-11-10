import type { InstallItem } from "@/lib/field";

export function InstallItems({ items }: { items: InstallItem[] }) {
  return (
    <section aria-labelledby="install-heading" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h2 id="install-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        What we&apos;re installing
      </h2>
      {items.length ? (
        <ul className="flex flex-col gap-2.5 text-sm text-foreground">
          {items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span className="whitespace-pre-line">{i.description}</span>
              {i.quantity !== 1 && <span className="shrink-0 tabular-nums text-muted-foreground">× {i.quantity}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          The office hasn&apos;t listed the items for this job yet. Check the notes and photos, or call the office.
        </p>
      )}
    </section>
  );
}
