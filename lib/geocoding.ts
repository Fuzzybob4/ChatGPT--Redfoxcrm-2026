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
  if (!token) {
    console.error("Mapbox token not configured");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${token}`
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
  zip: string
): Promise<GeocodeResult | null> {
  // Try full address first, then progressively simpler queries
  const queries = [
    `${address}, ${city}, ${state} ${zip}`,
    `${address}, ${city}, ${state}`,
    `${city}, ${state}`,
  ];

  for (const query of queries) {
    const result = await geocodeAddress(query);
    if (result) return result;
  }

  return null;
}
