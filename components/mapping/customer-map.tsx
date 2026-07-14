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
}

type MapView = "all" | "pending_installs" | "estimates_sent" | "installed" | "removed";

const STATUS_CONFIG: Record<Exclude<MapView, "all">, { label: string; description: string; color: string }> = {
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
  return p.mapStatus === view;
}

export function CustomerMap({ pins }: { pins: MapPin[] }) {
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
              <MapPin
                className="w-7 h-7 cursor-pointer drop-shadow-md"
                style={{ color: pinColor(p), fill: pinColor(p), fillOpacity: 0.25 }}
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
