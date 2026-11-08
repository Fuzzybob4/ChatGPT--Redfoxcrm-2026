/** Instant-quote pricing, shared by the public quote page and the server. */

export interface QuoteOption {
  label: string;
  price: number;
}

export interface QuoteSettings {
  slug: string;
  enabled: boolean;
  pricePerFoot1Story: number;
  pricePerFoot2Story: number;
  depositPercent: number;
  tolerancePercent: number;
  minimumTotal: number;
  wreaths: QuoteOption[];
  trees: QuoteOption[];
  intro: string | null;
}

export interface QuoteSelection {
  feet: number;
  stories: 1 | 2;
  /** quantity per option index */
  wreaths: Record<number, number>;
  trees: Record<number, number>;
}

export interface QuoteLine {
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteResult {
  lines: QuoteLine[];
  subtotal: number;
  total: number;
  deposit: number;
  minimumApplied: boolean;
}

const money = (n: number) => Math.round(n * 100) / 100;

export function normalizeOptions(raw: unknown): QuoteOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => ({ label: String((o as any)?.label ?? "").trim().slice(0, 60), price: Number((o as any)?.price ?? 0) }))
    .filter((o) => o.label && Number.isFinite(o.price) && o.price >= 0)
    .slice(0, 12);
}

export function settingsFromRow(row: Record<string, any>): QuoteSettings {
  return {
    slug: row.slug,
    enabled: Boolean(row.enabled),
    pricePerFoot1Story: Number(row.price_per_foot_1_story ?? 9),
    pricePerFoot2Story: Number(row.price_per_foot_2_story ?? 10),
    depositPercent: Number(row.deposit_percent ?? 50),
    tolerancePercent: Number(row.tolerance_percent ?? 15),
    minimumTotal: Number(row.minimum_total ?? 0),
    wreaths: normalizeOptions(row.wreaths),
    trees: normalizeOptions(row.trees),
    intro: row.intro ?? null,
  };
}

export function computeQuote(s: QuoteSettings, sel: QuoteSelection): QuoteResult {
  const lines: QuoteLine[] = [];
  const feet = Math.max(0, Math.min(2000, Math.round(sel.feet)));
  const perFoot = sel.stories === 2 ? s.pricePerFoot2Story : s.pricePerFoot1Story;
  if (feet > 0) {
    lines.push({
      label: `Roofline lighting (${sel.stories}-story), ${feet} ft`,
      quantity: feet,
      unitPrice: perFoot,
      total: money(feet * perFoot),
    });
  }
  const addOptions = (opts: QuoteOption[], picks: Record<number, number>, noun: string) => {
    opts.forEach((o, i) => {
      const qty = Math.max(0, Math.min(50, Math.floor(Number(picks?.[i] ?? 0))));
      if (qty > 0) lines.push({ label: `${noun} — ${o.label}`, quantity: qty, unitPrice: o.price, total: money(qty * o.price) });
    });
  };
  addOptions(s.wreaths, sel.wreaths, "Wreath");
  addOptions(s.trees, sel.trees, "Tree wrap");

  const subtotal = money(lines.reduce((a, l) => a + l.total, 0));
  const minimumApplied = subtotal > 0 && subtotal < s.minimumTotal;
  const total = minimumApplied ? money(s.minimumTotal) : subtotal;
  return { lines, subtotal, total, deposit: money((total * s.depositPercent) / 100), minimumApplied };
}
