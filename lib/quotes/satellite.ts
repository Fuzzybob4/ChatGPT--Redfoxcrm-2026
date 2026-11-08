import type { MeasureResult } from "@/lib/quotes/measure";

/** Mapbox static satellite image with the measured roofline drawn in yellow. */
export function satelliteUrl(token: string, m: Pick<MeasureResult, "line" | "lat" | "lng" | "imageCenter">) {
  const overlay = m.line
    ? `geojson(${encodeURIComponent(
        JSON.stringify({
          type: "Feature",
          properties: { stroke: "#ffcc00", "stroke-width": 6, "stroke-opacity": 0.95 },
          geometry: { type: "LineString", coordinates: m.line },
        }),
      )}),`
    : `pin-l+c2381e(${m.lng},${m.lat}),`;
  const [lng, lat] = m.imageCenter;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${overlay}${lng},${lat},19.3,0/640x400@2x?access_token=${token}`;
}
