"use client";

import { useMemo, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIFECYCLE_META, LIFECYCLE_ORDER, type LifecycleStatus } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";

export interface MapPin {
  id: string;
  customerId: string;
  propertyId: string;
  propertyName: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  isPrimary: boolean;
  stage: LifecycleStatus;
  troubleCallCount?: number;
  troubleCallUrgency?: string | null;
  troubleCallTitle?: string | null;
}

type MapView = "all" | "trouble_calls" | LifecycleStatus;

const TROUBLE_COLOR = "#ff2d55";
const ALL_COLOR = "#111827";

function hasTrouble(p: MapPin): boolean {
  return (p.troubleCallCount ?? 0) > 0;
}

function matchesView(p: MapPin, view: MapView): boolean {
  if (view === "all") return true;
  if (view === "trouble_calls") return hasTrouble(p);
  return p.stage === view;
}

export function CustomerMap({ pins }: { pins: MapPin[] }) {
  // Open on the work that needs attention when there is any.
  const [view, setView] = useState<MapView>(() =>
    pins.some((p) => p.stage === "pending_install") ? "pending_install" : "all",
  );
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selected, setSelected] = useState<MapPin | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(pins.map((p) => p.city).filter(Boolean))).sort(),
    [pins],
  );

  const counts = useMemo(() => {
    const byStage: Partial<Record<LifecycleStatus, number>> = {};
    for (const p of pins) byStage[p.stage] = (byStage[p.stage] ?? 0) + 1;
    return byStage;
  }, [pins]);

  // Always show the core install pipeline so the stages read as a sequence;
  // other stages appear only when customers are in them.
  const views = useMemo(() => {
    const core: LifecycleStatus[] = ["pending_install", "scheduled", "installed"];
    const stageViews = LIFECYCLE_ORDER.filter(
      (stage) => core.includes(stage) || (counts[stage] ?? 0) > 0,
    ).map((stage) => ({
      id: stage as MapView,
      label: LIFECYCLE_META[stage].label,
      color: LIFECYCLE_META[stage].color,
      count: counts[stage] ?? 0,
    }));
    const troubleCount = pins.filter(hasTrouble).length;
    return [
      { id: "all" as MapView, label: "All", color: ALL_COLOR, count: pins.length },
      ...(troubleCount > 0
        ? [{ id: "trouble_calls" as MapView, label: "Trouble Calls", color: TROUBLE_COLOR, count: troubleCount }]
        : []),
      ...stageViews,
    ];
  }, [pins, counts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pins.filter((p) => {
      if (!matchesView(p, view)) return false;
      if (cityFilter !== "all" && p.city !== cityFilter) return false;
      if (
        q &&
        !p.customerName.toLowerCase().includes(q) &&
        !p.propertyName.toLowerCase().includes(q) &&
        !p.address.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [pins, view, search, cityFilter]);

  const activeStageMeta = view !== "all" && view !== "trouble_calls" ? LIFECYCLE_META[view] : null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center rounded-lg border border-border bg-accent">
        <div className="flex max-w-md flex-col items-center gap-2 px-6 text-center">
          <MapPin className="size-8 text-muted-foreground" />
          <p className="font-medium text-foreground">Mapbox token required</p>
          <p className="text-sm text-muted-foreground">
            Add the NEXT_PUBLIC_MAPBOX_TOKEN environment variable to enable the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Stage tabs — horizontally scrollable on phones */}
      <div
        role="tablist"
        aria-label="Customer life stage"
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0"
      >
        {views.map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setView(v.id);
                setSelected(null);
              }}
              className={cn(
                "flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: v.color }} />
              {v.label}
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                  active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
                )}
              >
                {v.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeStageMeta && (
        <p className="text-sm text-muted-foreground">{activeStageMeta.description}</p>
      )}

      {/* Search + filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or address..."
            aria-label="Search customers"
            className="h-11 pl-9 text-base sm:h-9 sm:text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={cityFilter} onValueChange={(v) => setCityFilter(v ?? "all")}>
            <SelectTrigger aria-label="Filter by city" className="h-11 flex-1 sm:h-9 sm:w-48 sm:flex-none">
              <SelectValue>{cityFilter === "all" ? "All cities" : cityFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="whitespace-nowrap px-1 text-sm tabular-nums text-muted-foreground">
            {filtered.length} shown
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="min-h-[60vh] flex-1 overflow-hidden rounded-lg border border-border lg:min-h-96">
        <Map
          mapboxAccessToken={token}
          initialViewState={{ latitude: 30.2672, longitude: -97.7431, zoom: 9 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" />
          {filtered.map((p) => {
            const color = hasTrouble(p) ? TROUBLE_COLOR : LIFECYCLE_META[p.stage].color;
            return (
              <Marker
                key={p.id}
                latitude={p.lat}
                longitude={p.lng}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelected(p);
                }}
              >
                <div className="relative flex flex-col items-center">
                  {hasTrouble(p) && (
                    <>
                      {/* Pulsing alert ring for customers with an open trouble call */}
                      <span
                        className="pointer-events-none absolute -top-1 left-1/2 size-8 -translate-x-1/2 rounded-full"
                        style={{ backgroundColor: TROUBLE_COLOR, animation: "rf-ping 1.4s cubic-bezier(0,0,0.2,1) infinite" }}
                      />
                      <span
                        className="pointer-events-none absolute -top-2 left-1/2 flex size-4 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md"
                        style={{ backgroundColor: TROUBLE_COLOR }}
                      >
                        {p.troubleCallCount}
                      </span>
                    </>
                  )}
                  <MapPin
                    className="relative size-8 cursor-pointer drop-shadow-md"
                    style={{ color, fill: color, fillOpacity: hasTrouble(p) ? 0.35 : 0.3 }}
                    aria-label={`${p.customerName} — ${LIFECYCLE_META[p.stage].label}`}
                  />
                </div>
              </Marker>
            );
          })}

          {selected && (
            <Popup
              latitude={selected.lat}
              longitude={selected.lng}
              anchor="top"
              onClose={() => setSelected(null)}
              closeButton={false}
              maxWidth="280px"
            >
              <div className="flex flex-col gap-1.5 p-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selected.customerName}</p>
                    {selected.propertyName && <p className="text-xs text-gray-600">{selected.propertyName}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="-m-2 flex size-8 items-center justify-center text-gray-400 hover:text-gray-600"
                    aria-label="Close popup"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <span
                  className="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: LIFECYCLE_META[selected.stage].color }}
                >
                  {LIFECYCLE_META[selected.stage].label}
                </span>
                <p className="text-xs text-gray-600">{selected.address}</p>
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="text-xs text-gray-600 hover:underline">
                    {selected.phone}
                  </a>
                )}
                {hasTrouble(selected) && (
                  <div className="mt-1 rounded-md border border-red-200 bg-red-50 p-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: TROUBLE_COLOR, animation: "rf-pulse 1.4s ease-in-out infinite" }}
                      />
                      <span className="text-[11px] font-semibold text-red-700">
                        {selected.troubleCallCount} open trouble call{(selected.troubleCallCount ?? 0) > 1 ? "s" : ""}
                        {selected.troubleCallUrgency ? ` · ${selected.troubleCallUrgency}` : ""}
                      </span>
                    </div>
                    {selected.troubleCallTitle && (
                      <p className="mt-0.5 text-[11px] text-red-600">{selected.troubleCallTitle}</p>
                    )}
                    <a href="/tickets" className="mt-0.5 block text-[11px] font-medium text-red-700 hover:underline">
                      View in trouble calls
                    </a>
                  </div>
                )}
                <a
                  href={`/customers/${selected.customerId}`}
                  className="block pt-1 text-xs font-medium text-red-600 hover:underline"
                >
                  View customer and change stage
                </a>
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
