"use client";

import { useOptimistic, useTransition } from "react";
import { CheckSquare, Square } from "lucide-react";
import { setMaterialChecked } from "@/app/field/actions";

/** Load-out checklist for the job: tick items off at the shop so nothing gets left behind. */
export function MaterialsChecklist({
  jobId,
  items,
  checked,
  canEdit,
}: {
  jobId: string;
  items: string[];
  /** item → who checked it */
  checked: Record<string, string>;
  canEdit: boolean;
}) {
  const [, start] = useTransition();
  const [state, setState] = useOptimistic(checked, (cur: Record<string, string>, change: { key: string; on: boolean }) => {
    const next = { ...cur };
    if (change.on) next[change.key] = "you";
    else delete next[change.key];
    return next;
  });
  if (!items.length) return null;
  const done = items.filter((i) => state[i]).length;

  const toggle = (key: string) => {
    if (!canEdit) return;
    const on = !state[key];
    start(async () => {
      setState({ key, on });
      await setMaterialChecked(jobId, key, on);
    });
  };

  return (
    <section aria-labelledby="load-heading" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="load-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Load-out checklist
        </h2>
        <span className={`text-xs font-medium tabular-nums ${done === items.length ? "text-emerald-600" : "text-muted-foreground"}`}>
          {done}/{items.length} loaded
        </span>
      </div>
      <ul className="flex flex-col">
        {items.map((item) => {
          const on = Boolean(state[item]);
          return (
            <li key={item}>
              <button type="button" disabled={!canEdit} onClick={() => toggle(item)}
                className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left text-[15px] disabled:opacity-70">
                {on ? <CheckSquare className="size-5 shrink-0 text-emerald-600" /> : <Square className="size-5 shrink-0 text-muted-foreground" />}
                <span className={on ? "text-muted-foreground line-through" : "text-foreground"}>{item}</span>
                {on && state[item] !== "you" && <span className="ml-auto text-xs text-muted-foreground">{state[item]}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
