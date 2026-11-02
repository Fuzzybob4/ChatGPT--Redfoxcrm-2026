"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { geocodeMissingCustomers } from "@/app/(crm)/customers/geocode-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** A customer with no pin (no geocoded address/property). */
export interface UnmappedCustomer {
  customerId: string;
  customerName: string;
  address: string;
  hasStreetAddress: boolean;
}

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
  mapStatus: "all_customers" | "pending_installs" | "estimates_sent" | "installed" | "removed";
  troubleCallCount?: number;
  troubleCallUrgency?: string | null;
  troubleCallTitle?: string | null;
}

type MapView = "all" | "trouble_calls" | "pending_installs" | "estimates_sent" | "installed" | "removed";

const TROUBLE_COLOR = "#ff2d55";

function hasTrouble(p: MapPin): boolean {
  return (p.troubleCallCount ?? 0) > 0;
}

const STATUS_CONFIG: Record<Exclude<MapView, "all" | "trouble_calls">, { label: string; description: string; color: string }> = {
  pending_installs: { label: "Pending Install",  description: "Job scheduled, not yet started",       color: "#dc2626" },
  estimates_sent:   { label: "Estimate Sent",    description: "Estimate sent, no job scheduled yet",  color: "#f59e0b" },
  installed:        { label: "Installed",         description: "Install job completed",                color: "#16a34a" },
  removed:          { label: "Removed",           description: "Removal job completed",               color: "#6b7280" },
};

function pinColor(p: MapPin): string {
  if (p.mapStatus === "all_customers") return "#111827";
  return STATUS_CONFIG[p.mapStatus].color;
}

function matchesView(p: MapPin, view: MapView): boolean {
  if (view === "all") return true;
  if (view === "trouble_calls") return hasTrouble(p);
  return p.mapStatus === view;
}

export function CustomerMap({ pins, unmapped = [] }: { pins: MapPin[]; unmapped?: UnmappedCustomer[] }) {
  const router = useRouter();
  const [locating, startLocating] = useTransition();
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  const [view, setView] = useState<MapView>("all");
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selected, setSelected] = useState<MapPin | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(pins.map((p) => p.city).filter(Boolean))).sort(),
    [pins]
  );

  // Build filter tabs with all status options
  const views = useMemo(() => {
    const present = new Set(pins.map((p) => p.mapStatus).filter((s) => s !== "all_customers"));
    const anyTrouble = pins.some(hasTrouble);
    return [
      { id: "all" as MapView, label: "All Customers", color: "#111827" },
      ...(anyTrouble
        ? [{ id: "trouble_calls" as MapView, label: "Trouble Calls", color: TROUBLE_COLOR }]
        : []),
      ...(present.has("pending_installs")
        ? [{ id: "pending_installs" as MapView, label: STATUS_CONFIG.pending_installs.label, color: STATUS_CONFIG.pending_installs.color }]
        : []),
      ...(present.has("estimates_sent")
        ? [{ id: "estimates_sent" as MapView, label: STATUS_CONFIG.estimates_sent.label, color: STATUS_CONFIG.estimates_sent.color }]
        : []),
      ...(present.has("installed")
        ? [{ id: "installed" as MapView, label: STATUS_CONFIG.installed.label, color: STATUS_CONFIG.installed.color }]
        : []),
      ...(present.has("removed")
        ? [{ id: "removed" as MapView, label: STATUS_CONFIG.removed.label, color: STATUS_CONFIG.removed.color }]
        : []),
    ];
  }, [pins]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pins.filter((p) => {
      if (!matchesView(p, view)) return false;
      if (cityFilter !== "all" && p.city !== cityFilter) return false;
      if (q && !p.customerName.toLowerCase().includes(q) && !p.propertyName.toLowerCase().includes(q) && !p.address.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [pins, view, search, cityFilter]);

  // Search used to look only at pins, so customers without coordinates
  // (e.g. "QA Test 2") returned 0 results. Surface them separately.
  const unmappedMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return unmapped.filter(
      (u) => u.customerName.toLowerCase().includes(q) || u.address.toLowerCase().includes(q),
    );
  }, [unmapped, search]);
  const locatable = unmapped.filter((u) => u.hasStreetAddress).length;

  function locateMissing() {
    setLocateMsg(null);
    startLocating(async () => {
      try {
        const r = await geocodeMissingCustomers();
        setLocateMsg(`Located ${r.located} of ${r.attempted} customer${r.attempted === 1 ? "" : "s"}.`);
        router.refresh();
      } catch {
        setLocateMsg("Could not locate customers. Please try again.");
      }
    });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center rounded-lg border border-border bg-accent">
        <div className="text-center space-y-2 max-w-md px-6">
          <MapPin className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="font-medium text-foreground">Mapbox token required</p>
          <p className="text-sm text-muted-foreground">
            Add the NEXT_PUBLIC_MAPBOX_TOKEN environment variable to enable the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* View tabs */}
      <div className="flex flex-wrap gap-2">
        {views.map((v) => {
          const count = pins.filter((p) => matchesView(p, v.id)).length;
          return (
            <button
              key={v.id}
              onClick={() => {
                setView(v.id);
                setSelected(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                view === v.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: v.color }}
              />
              {v.label}
              <Badge
                variant="secondary"
                className={cn(
                  "h-5 px-1.5 text-[10px]",
                  view === v.id && "bg-background/20 text-background"
                )}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or address..."
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select value={cityFilter} onValueChange={(v) => setCityFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All cities" />
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
        <div className="flex items-center px-3 text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} shown
        </div>
      </div>

      {(unmappedMatches.length > 0 || locatable > 0) && (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm">
          {unmappedMatches.length > 0 && (
            <div className="mb-1">
              <p className="text-xs font-medium text-muted-foreground">
                {unmappedMatches.length} matching customer{unmappedMatches.length === 1 ? " is" : "s are"} not on the map yet:
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {unmappedMatches.slice(0, 10).map((u) => (
                  <li key={u.customerId}>
                    <Link href={`/customers/${u.customerId}`} className="font-medium text-primary hover:underline">
                      {u.customerName}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">
                      {u.hasStreetAddress ? `(${u.address} — not geocoded)` : "(no street address)"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {locatable > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {locatable} customer{locatable === 1 ? " has" : "s have"} an address but no map location.
              </span>
              <Button size="xs" variant="outline" onClick={locateMissing} disabled={locating}>
                {locating ? "Locating…" : "Locate now"}
              </Button>
              {locateMsg && <span>{locateMsg}</span>}
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 min-h-96 rounded-lg overflow-hidden border border-border">
        <Map
          mapboxAccessToken={token}
          initialViewState={{ latitude: 30.2672, longitude: -97.7431, zoom: 9 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" />
          {filtered.map((p) => (
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
                  className="relative w-7 h-7 cursor-pointer drop-shadow-md"
                  style={
                    hasTrouble(p)
                      ? { color: TROUBLE_COLOR, fill: TROUBLE_COLOR, fillOpacity: 0.35 }
                      : { color: pinColor(p), fill: pinColor(p), fillOpacity: 0.25 }
                  }
                />
              </div>
            </Marker>
          ))}

          {selected && (
            <Popup
              latitude={selected.lat}
              longitude={selected.lng}
              anchor="top"
              onClose={() => setSelected(null)}
              closeButton={false}
              maxWidth="280px"
            >
              <div className="space-y-1.5 p-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{selected.customerName}</p>
                    {selected.propertyName && <p className="text-xs text-gray-600">{selected.propertyName}</p>}
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Close popup"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-gray-600">{selected.address}</p>
                <p className="text-xs text-gray-600">{selected.phone}</p>
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
                {selected.mapStatus !== "all_customers" && (
                  <div className="pt-1 space-y-0.5">
                    <span
                      className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: STATUS_CONFIG[selected.mapStatus].color }}
                    >
                      {STATUS_CONFIG[selected.mapStatus].label}
                    </span>
                    <p className="text-[10px] text-gray-500">
                      {STATUS_CONFIG[selected.mapStatus].description}
                    </p>
                  </div>
                )}
                <a
                  href={`/customers/${selected.customerId}`}
                  className="block text-xs font-medium text-red-600 hover:underline pt-1"
                >
                  View customer
                </a>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* Legend for All view */}
      {view === "all" && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {views
            .filter((v) => v.id !== "all")
            .map((v) => (
              <span key={v.id} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: v.color }}
                />
                {v.label}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
