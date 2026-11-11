import type { LegalSection } from "@/lib/legal";

/** Renders a Terms / Privacy document from lib/legal.ts. */
export function LegalDoc({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground mb-10">Last updated: {updated}</p>
      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground mb-3">{s.title}</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              {s.body.map((b, i) =>
                typeof b === "string" ? (
                  <p key={i}>{b}</p>
                ) : (
                  <ul key={i} className="list-disc pl-6 space-y-2">
                    {b.list.map((li, j) => (
                      <li key={j}>{li}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
