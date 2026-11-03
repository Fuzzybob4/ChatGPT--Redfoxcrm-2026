"use client";

import { useMemo, useState } from "react";
import Map, { GeolocateControl, Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";

import type { FieldHome } from "@/lib/field-homes";
import { LIFECYCLE_META } from "@/lib/lifecycle";
import { HomeCard } from "./home-card";

export function HomesMap({ homes }: { homes: FieldHome[] }) {
  const [selected, setSelected] = useState<FieldHome | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapped = useMemo(() => homes.filter((h) => h.lat != null && h.lng != null), [homes]);

  const initialView = useMemo(() => {
    if (mapped.length === 0) return { latitude: 30.2672, longitude: -97.7431, zoom: 9 };
    if (mapped.length === 1) return { latitude: mapped[0].lat!, longitude: mapped[0].lng!, zoom: 13 };
    const lats = mapped.map((h) => h.lat!);
    const lngs = mapped.map((h) => h.lng!);
    return {
      bounds: [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 50, maxZoom: 14 },
    };
  }, [mapped]);

  if (!token) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        The map isn&apos;t set up yet. Ask the office to add a Mapbox token.
      </p>
    );
  }

  const unmapped = homes.length - mapped.length;

  return (
    <div className="flex flex-1 flex-col gap-2">
      {unmapped > 0 && (
        <p className="px-4 text-sm text-muted-foreground">
          {unmapped} home{unmapped === 1 ? " isn't" : "s aren't"} on the map yet. Switch to List to see {unmapped === 1 ? "it" : "them"}.
        </p>
      )}
      {/* Remount when the filtered set changes so the map refits to the new pins. */}
      <div key={mapped.map((h) => h.customerId).join()} className="relative min-h-[58dvh] flex-1 overflow-hidden border-y border-border">
        <Map
          mapboxAccessToken={token}
          initialViewState={initialView}
          style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" showCompass={false} />
          <GeolocateControl position="top-right" trackUserLocation />
          {mapped.map((home) => {
            const color = LIFECYCLE_META[home.stage].color;
            return (
              <Marker
                key={home.customerId}
                latitude={home.lat!}
                longitude={home.lng!}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelected(home);
                }}
              >
                <button type="button" className="flex size-11 items-end justify-center" aria-label={home.name}>
                  <MapPin className="size-9 drop-shadow-md" style={{ color, fill: color, fillOpacity: 0.3 }} />
                </button>
              </Marker>
            );
          })}
          {selected && selected.lat != null && selected.lng != null && (
            <Popup
              latitude={selected.lat}
              longitude={selected.lng}
              anchor="top"
              onClose={() => setSelected(null)}
              closeButton={false}
              maxWidth="320px"
            >
              <div className="w-72 p-1 font-sans">
                <HomeCard home={selected} compact />
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
