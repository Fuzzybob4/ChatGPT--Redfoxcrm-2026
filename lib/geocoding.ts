/**
 * Geocoding utilities for converting addresses to coordinates using Mapbox
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!address.trim()) return null;
  if (!token) {
    console.error("Mapbox token not configured");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?country=us&limit=1&access_token=${token}`,
      // Never let a slow Mapbox call hold up a save for long.
      { signal: AbortSignal.timeout(5000), cache: "no-store" },
    );

    if (!response.ok) {
      console.error("Geocoding request failed:", response.statusText);
      return null;
    }

    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const [lng, lat] = feature.geometry.coordinates;

    return {
      lat,
      lng,
      formattedAddress: feature.place_name,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Geocode multiple addresses in batch and return the first successful result
 */
export async function geocodePropertyAddress(
  address: string,
  city: string,
  state: string,
  zip: string,
  options: { allowCityFallback?: boolean } = {},
): Promise<GeocodeResult | null> {
  const { allowCityFallback = true } = options;
  const join = (...parts: (string | null | undefined)[]) =>
    parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
  const street = (address ?? "").trim();
  const stateZip = [state, zip].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");

  // Try full address first, then progressively simpler queries. Blank parts
  // are skipped (previously "", ,  " was sent to Mapbox and could match junk).
  const queries = Array.from(
    new Set(
      [
        street ? join(street, city, stateZip) : "",
        street ? join(street, city, state) : "",
        allowCityFallback ? join(city, state) : "",
      ].filter((q) => q.length > 0),
    ),
  );

  for (const query of queries) {
    const result = await geocodeAddress(query);
    if (result) return result;
  }

  return null;
}
