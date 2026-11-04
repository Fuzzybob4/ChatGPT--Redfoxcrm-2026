"use client";

import { useMemo, useState } from "react";
import { List, Map as MapIcon, Search } from "lucide-react";

import type { FieldHome, LeadStage } from "@/lib/field-homes";
import { LIFECYCLE_META } from "@/lib/lifecycle";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HomesMap } from "./homes-map";
import { HomeCard } from "./home-card";

const STAGES: LeadStage[] = ["pending_install", "pending_removal", "removed"];

export function HomesView({
  homes,
  title = "Homes",
  defaultView = "list",
  canManage = true,
}: {
  homes: FieldHome[];
  title?: string;
  defaultView?: "list" | "map";
  canManage?: boolean;
}) {
  const [stage, setStage] = useState<LeadStage>(() =>
    homes.some((h) => h.stage === "pending_install") ? "pending_install" : (homes[0]?.stage ?? "pending_install"),
  );
  const [view, setView] = useState<"list" | "map">(defaultView);
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<LeadStage, number> = { pending_install: 0, pending_removal: 0, removed: 0 };
    for (const h of homes) c[h.stage] += 1;
    return c;
  }, [homes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return homes.filter(
      (h) => h.stage === stage && (!q || h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q)),
    );
  }, [homes, stage, query]);

  return (
    <div className="flex flex-1 flex-col gap-4 pt-5">
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground text-pretty">{LIFECYCLE_META[stage].description}</p>
        </div>
        <div role="tablist" aria-label="View" className="flex shrink-0 rounded-lg border border-border bg-muted p-0.5">
          {([
            { id: "list", label: "List", icon: List },
            { id: "map", label: "Map", icon: MapIcon },
          ] as const).map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                view === v.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <v.icon className="size-4" aria-hidden="true" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Home stage"
        className="flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
      >
        {STAGES.map((s) => {
          const active = s === stage;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStage(s)}
              className={cn(
                "flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: LIFECYCLE_META[s].color }} />
              {LIFECYCLE_META[s].label}
              <span className="tabular-nums opacity-70">{counts[s]}</span>
            </button>
          );
        })}
      </div>

      {view === "list" && (
        <div className="relative px-4">
          <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or address"
            aria-label="Search homes"
            className="h-11 pl-9 text-base"
          />
        </div>
      )}

      {view === "map" ? (
        <HomesMap homes={visible} canManage={canManage} />
      ) : visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {query ? "No homes match that search." : `No homes are ${LIFECYCLE_META[stage].label.toLowerCase()} right now.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 px-4 pb-6">
          {visible.map((home) => (
            <li key={home.customerId}>
              <HomeCard home={home} canManage={canManage} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
