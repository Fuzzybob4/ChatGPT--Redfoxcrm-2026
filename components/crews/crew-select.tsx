"use client";

import { useEffect, useState, useTransition } from "react";
import { listCrews, quickAddCrew } from "@/app/(crm)/schedule/actions";

export interface CrewOption {
  id: string;
  name: string;
  color?: string;
  active?: boolean;
}

const ADD = "__add__";

/**
 * The one crew picker used everywhere (jobs, team members, schedule). It reads
 * the same crew list the Crew Schedule uses; "+ Add a crew" creates a real
 * crew instead of a typed name.
 *
 * Use `name` to submit with a plain form (the crew id goes in a hidden field),
 * or `value` + `onChange` when the parent keeps state.
 */
export function CrewSelect({
  value,
  defaultValue,
  onChange,
  name,
  id,
  crews: given,
  className,
  noneLabel = "No crew",
}: {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (crewId: string) => void;
  name?: string;
  id?: string;
  crews?: CrewOption[];
  className?: string;
  noneLabel?: string;
}) {
  const [crews, setCrews] = useState<CrewOption[]>(given ?? []);
  const [own, setOwn] = useState<string>(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = value !== undefined ? value ?? "" : own;

  useEffect(() => {
    if (given) {
      setCrews(given);
      return;
    }
    let live = true;
    listCrews().then((list) => live && setCrews(list)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [given]);

  function pick(next: string) {
    setError(null);
    if (next === ADD) {
      const label = window.prompt("New crew name (for example: Crew B)")?.trim();
      if (!label) return;
      start(async () => {
        const res = await quickAddCrew(label);
        if (!res.ok) return setError(res.error);
        setCrews((list) => (list.some((c) => c.id === res.crew.id) ? list : [...list, res.crew]));
        setOwn(res.crew.id);
        onChange?.(res.crew.id);
      });
      return;
    }
    setOwn(next);
    onChange?.(next);
  }

  const shown = crews.filter((c) => c.active !== false || c.id === current);

  return (
    <div className="space-y-1">
      <select
        id={id}
        value={current}
        disabled={pending}
        onChange={(e) => pick(e.target.value)}
        className={className ?? "h-9 w-full rounded-md border border-input bg-background px-2 text-sm"}
      >
        <option value="">{noneLabel}</option>
        {shown.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={ADD}>+ Add a crew…</option>
      </select>
      {name && <input type="hidden" name={name} value={current} />}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
