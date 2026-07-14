"use client";

import { useMemo, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface MapCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  mapStatus: "all_customers" | "pending_installs" | "estimates_sent" | "installed" | "removed";
}

type MapView = "all" | "pending_installs" | "estimates_sent" | "installed" | "removed";

const STATUS_CONFIG: Record<Exclude<MapView, "all">, { label: string; color: string }> = {
  pending_installs: { label: "Pending Installs", color: "#dc2626" },
  estimates_sent: { label: "Estimates Sent", color: "#f59e0b" },
  installed: { label: "Installed", color: "#16a34a" },
  removed: { label: "Removed", color: "#6b7280" },
};

function pinColor(c: MapCustomer): string {
  if (c.mapStatus === "all_customers") return "#111827";
  return STATUS_CONFIG[c.mapStatus].color;
}

function matchesView(c: MapCustomer, view: MapView): boolean {
  if (view === "all") return true;
  return c.mapStatus === view;
}

export function CustomerMap({ customers }: { customers: MapCustomer[] }) {
  const [view, setView] = useState<MapView>("all");
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selected, setSelected] = useState<MapCustomer | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(customers.map((c) => c.city).filter(Boolean))).sort(),
    [customers]
  );

  // Build filter tabs with all status options
  const views = useMemo(() => {
    const present = new Set(customers.map((c) => c.mapStatus).filter((s) => s !== "all_customers"));
    return [
      { id: "all" as MapView, label: "All Customers", color: "#111827" },
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
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (!matchesView(c, view)) return false;
      if (cityFilter !== "all" && c.city !== cityFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.address.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [customers, view, search, cityFilter]);

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
          const count = customers.filter((c) => matchesView(c, v.id)).length;
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

      {/* Map */}
      <div className="flex-1 min-h-96 rounded-lg overflow-hidden border border-border">
        <Map
          mapboxAccessToken={token}
          initialViewState={{ latitude: 30.2672, longitude: -97.7431, zoom: 9 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" />
          {filtered.map((c) => (
            <Marker
              key={c.id}
              latitude={c.lat}
              longitude={c.lng}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelected(c);
              }}
            >
              <MapPin
                className="w-7 h-7 cursor-pointer drop-shadow-md"
                style={{ color: pinColor(c), fill: pinColor(c), fillOpacity: 0.25 }}
              />
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
                  <p className="font-semibold text-sm text-gray-900">{selected.name}</p>
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
                <div className="flex flex-wrap gap-1 pt-1">
                  {selected.mapStatus !== "all_customers" && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: STATUS_CONFIG[selected.mapStatus].color }}
                    >
                      {STATUS_CONFIG[selected.mapStatus].label}
                    </span>
                  )}
                </div>
                <a
                  href={`/customers/${selected.id}`}
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
