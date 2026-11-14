import type { InstallItem } from "@/lib/field";

/**
 * Install list, laid out like a Square invoice: the item name in bold with its
 * quantity ("Front window outline × 50"), and the item's details underneath in
 * grey. Never shows prices. Used on crew job pages and the office customer page.
 */
export function InstallItems({
  items,
  title = "What we're installing",
  emptyText = "The office hasn't listed the items for this job yet. Check the notes and photos, or call the office.",
  bare = false,
}: {
  items: InstallItem[];
  title?: string;
  emptyText?: string;
  /** Leave off the outer box and heading (when a card already provides them). */
  bare?: boolean;
}) {
  const list = items.length ? (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((i, idx) => {
        const [name, ...details] = i.description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const qty = Number.isFinite(i.quantity) && i.quantity !== 1 ? ` × ${Number(i.quantity.toFixed(2))}` : "";
        return (
          <li key={idx} className="py-2.5 first:pt-0 last:pb-0">
            <p className="text-[15px] font-semibold leading-snug text-foreground">
              {name}
              {qty && <span className="whitespace-nowrap tabular-nums">{qty}</span>}
            </p>
            {details.length > 0 && (
              <div className="mt-0.5 space-y-0.5 text-sm leading-snug text-muted-foreground">
                {details.map((d, j) => (
                  <p key={j}>{d}</p>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">{emptyText}</p>
  );

  if (bare) return list;
  return (
    <section aria-labelledby="install-heading" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h2 id="install-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {list}
    </section>
  );
}
