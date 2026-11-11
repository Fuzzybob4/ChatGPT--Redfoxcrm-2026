"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Navigation } from "lucide-react";

import type { FieldMapStop } from "@/lib/field";
import { cn } from "@/lib/utils";
import { directionsUrl, formatClock, formatDay, jobTypeLabel, localToday } from "./format";

const TODAY_COLOR = "#c8102e";
const LATER_COLOR = "#1f2937";

export function FieldMap({
  stops,
  unmappedCount,
  todayOnly = false,
}: {
  stops: FieldMapStop[];
  unmappedCount: number;
  todayOnly?: boolean;
}) {
  const [range, setRange] = useState<"today" | "all">("today");
  const [selected, setSelected] = useState<FieldMapStop | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const today = localToday();
  const visible = useMemo(
    () => (range === "today" ? stops.filter((s) => s.job.scheduledDate === today) : stops),
    [stops, range, today],
  );

  const initialView = useMemo(() => {
    if (stops.length === 0) return { latitude: 30.2672, longitude: -97.7431, zoom: 9 };
    if (stops.length === 1) return { latitude: stops[0].lat, longitude: stops[0].lng, zoom: 13 };
    const lats = stops.map((s) => s.lat);
    const lngs = stops.map((s) => s.lng);
    return {
      bounds: [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 60, maxZoom: 14 },
    };
  }, [stops]);

  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        The map isn&apos;t set up yet. Ask the office to add a Mapbox token.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Job map</h1>
        {!todayOnly && (
        <div role="tablist" aria-label="Which jobs" className="flex rounded-lg border border-border bg-muted p-0.5">
          {(["today", "all"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => {
                setRange(r);
                setSelected(null);
              }}
              className={cn(
                "min-h-10 rounded-md px-4 text-sm font-medium transition-colors",
                range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {r === "today" ? "Today" : "All upcoming"}
            </button>
          ))}
        </div>
        )}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {range === "today" ? "No jobs on your schedule today." : "No upcoming jobs with a mapped address yet."}
        </p>
      )}
      {unmappedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {unmappedCount} job{unmappedCount === 1 ? " has" : "s have"} no map location. Open it from Work orders for directions.
        </p>
      )}

      <div className="relative -mx-4 min-h-[60dvh] flex-1 overflow-hidden border-y border-border">
        <Map
          mapboxAccessToken={token}
          initialViewState={initialView}
          style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" showCompass={false} />
          <GeolocateControl position="top-right" trackUserLocation />
          {visible.map((stop) => {
            const color = stop.job.scheduledDate === today ? TODAY_COLOR : LATER_COLOR;
            return (
              <Marker
                key={stop.job.id}
                latitude={stop.lat}
                longitude={stop.lng}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelected(stop);
                }}
              >
                <button
                  type="button"
                  className="flex size-11 items-end justify-center"
                  aria-label={`${stop.job.customerName}, ${formatDay(stop.job.scheduledDate)}`}
                >
                  <MapPin className="size-9 drop-shadow-md" style={{ color, fill: color, fillOpacity: 0.3 }} />
                </button>
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
              maxWidth="300px"
            >
              <div className="flex flex-col gap-2 p-1 font-sans">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.job.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {jobTypeLabel(selected.job.jobType)} · {formatDay(selected.job.scheduledDate)}
                    {selected.job.startTime ? ` · ${formatClock(selected.job.startTime)}` : ""}
                  </p>
                  {selected.job.address && <p className="mt-1 text-xs text-muted-foreground">{selected.job.address}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selected.job.address && (
                    <a
                      href={directionsUrl(selected.job.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-semibold text-foreground"
                    >
                      <Navigation className="size-3.5" aria-hidden="true" />
                      Directions
                    </a>
                  )}
                  <Link
                    href={`/field/jobs/${selected.job.id}`}
                    className="flex min-h-11 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
                  >
                    Open job
                  </Link>
                </div>
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
