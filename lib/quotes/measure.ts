import "server-only";

/**
 * Address → location → estimated front roofline length.
 *
 * Geocoding uses Mapbox (NEXT_PUBLIC_MAPBOX_TOKEN). Roof geometry comes from
 * the Google Solar API buildingInsights endpoint (GOOGLE_SOLAR_API_KEY), which
 * returns each roof segment's pitch, azimuth (direction it faces), ground
 * area and bounding box. Google does not return a "front roofline length", so
 * we derive it:
 *
 * 1. Front direction = the roof-facing direction closest to the bearing from
 *    the building center toward the street address point.
 * 2. For each roof segment, recover its rectangle (slope run a, eave length b)
 *    from its axis-aligned bounding box, its azimuth and its ground area.
 * 3. Front roofline = eave length of front-facing segments (within 45°) plus
 *    the rake (sloped edge) of side-facing segments in the front half, which
 *    is where front gables are lit.
 *
 * The result is an estimate the customer sees drawn on satellite imagery and
 * can adjust; the business can re-price if its own measurement differs by
 * more than its tolerance.
 */

export interface MeasureResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
  street: string | null;
  feet: number | null;
  source: "satellite" | "none";
  /** [lng, lat] pairs of the drawn front roofline, when measured */
  line: Array<[number, number]> | null;
  imageCenter: [number, number];
}

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const angleDiff = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Local meters (east, north) relative to an origin. */
function toLocal(origin: { lat: number; lng: number }, lat: number, lng: number) {
  return {
    x: toRad(lng - origin.lng) * R * Math.cos(toRad(origin.lat)),
    y: toRad(lat - origin.lat) * R,
  };
}
function fromLocal(origin: { lat: number; lng: number }, x: number, y: number): [number, number] {
  return [origin.lng + toDeg(x / (R * Math.cos(toRad(origin.lat)))), origin.lat + toDeg(y / R)];
}

interface LatLng { latitude: number; longitude: number }
interface Segment {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  stats?: { areaMeters2?: number; groundAreaMeters2?: number };
  center?: LatLng;
  boundingBox?: { sw: LatLng; ne: LatLng };
}

/** Recover rectangle sides (run a along azimuth, eave b across it) for one segment. */
function segmentSides(seg: Segment, origin: { lat: number; lng: number }) {
  const bb = seg.boundingBox!;
  const sw = toLocal(origin, bb.sw.latitude, bb.sw.longitude);
  const ne = toLocal(origin, bb.ne.latitude, bb.ne.longitude);
  const W = Math.abs(ne.x - sw.x);
  const H = Math.abs(ne.y - sw.y);
  const G = Number(seg.stats?.groundAreaMeters2 ?? 0) || W * H * 0.8;
  const al = toRad(seg.azimuthDegrees ?? 0);
  const s = Math.abs(Math.sin(al));
  const c = Math.abs(Math.cos(al));
  const det = s * s - c * c;
  let a: number;
  let b: number;
  if (Math.abs(det) > 0.25) {
    // W = a*s + b*c ; H = a*c + b*s
    a = (W * s - H * c) / det;
    b = (H * s - W * c) / det;
  } else {
    // Near 45°: use a + b ≈ (W + H) / (s + c) and a*b ≈ G.
    const sum = (W + H) / (s + c || 1);
    const disc = Math.max(sum * sum - 4 * G, 0);
    b = (sum + Math.sqrt(disc)) / 2;
    a = sum - b;
  }
  if (!(a > 0.5) || !(b > 0.5)) {
    b = Math.sqrt(G * 1.6);
    a = G / b;
  }
  return { a, b, W, H };
}

export async function geocodeAddress(address: string) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("Address lookup is not configured");
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=us&types=address&limit=1&access_token=${token}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Address lookup failed");
  const data = await res.json();
  const f = data?.features?.[0];
  if (!f) return null;
  const ctx: Array<{ id: string; text: string; short_code?: string }> = f.context ?? [];
  const pick = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix));
  const region = pick("region");
  return {
    formattedAddress: f.place_name as string,
    lng: f.center[0] as number,
    lat: f.center[1] as number,
    street: [f.address, f.text].filter(Boolean).join(" ") || null,
    city: pick("place")?.text ?? null,
    state: region?.short_code?.replace(/^US-/, "") ?? region?.text ?? null,
    zip: pick("postcode")?.text ?? null,
  };
}

export async function measureAddress(address: string): Promise<MeasureResult | null> {
  const geo = await geocodeAddress(address);
  if (!geo) return null;
  const base: MeasureResult = {
    formattedAddress: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    city: geo.city,
    state: geo.state,
    zip: geo.zip,
    street: geo.street,
    feet: null,
    source: "none",
    line: null,
    imageCenter: [geo.lng, geo.lat],
  };

  const key = process.env.GOOGLE_SOLAR_API_KEY;
  if (!key) return base;

  try {
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${geo.lat}&location.longitude=${geo.lng}&requiredQuality=MEDIUM&key=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return base;
    const b = await res.json();
    const center = { lat: Number(b?.center?.latitude), lng: Number(b?.center?.longitude) };
    const segments: Segment[] = (b?.solarPotential?.roofSegmentStats ?? []).filter(
      (s: Segment) => s.boundingBox && Number(s.stats?.groundAreaMeters2 ?? 0) >= 4,
    );
    if (!Number.isFinite(center.lat) || segments.length === 0) return base;

    // 1. Front direction.
    const toStreet = bearing(center.lat, center.lng, geo.lat, geo.lng);
    const streetPointFar = Math.hypot(toLocal(center, geo.lat, geo.lng).x, toLocal(center, geo.lat, geo.lng).y) > 4;
    const largest = [...segments].sort((x, y) => Number(y.stats?.groundAreaMeters2) - Number(x.stats?.groundAreaMeters2))[0];
    const mainAz = largest.azimuthDegrees ?? 0;
    const candidates = [mainAz, mainAz + 90, mainAz + 180, mainAz + 270].map((a) => a % 360);
    const frontAz = streetPointFar
      ? candidates.sort((x, y) => angleDiff(x, toStreet) - angleDiff(y, toStreet))[0]
      : mainAz;
    const fr = toRad(frontAz);
    const fx = Math.sin(fr); // front unit vector (east, north)
    const fy = Math.cos(fr);

    // 2–3. Sum front eaves and front gable rakes.
    let meters = 0;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const seg of segments) {
      const az = seg.azimuthDegrees ?? 0;
      const { a, b: eave } = segmentSides(seg, center);
      const c = toLocal(center, seg.center?.latitude ?? center.lat, seg.center?.longitude ?? center.lng);
      const u = c.x * fx + c.y * fy; // distance toward the front
      const v = -c.x * fy + c.y * fx; // sideways
      const diff = angleDiff(az, frontAz);
      if (diff <= 45) {
        meters += eave;
        uMax = Math.max(uMax, u + a / 2);
        vMin = Math.min(vMin, v - eave / 2);
        vMax = Math.max(vMax, v + eave / 2);
      } else if (diff >= 45 && diff <= 135 && u > 0) {
        const pitch = toRad(Math.min(Math.max(seg.pitchDegrees ?? 25, 5), 60));
        meters += a / Math.cos(pitch);
      }
    }
    if (meters <= 0) return base;
    const feet = Math.round((meters * 3.28084) / 5) * 5;
    if (feet < 15 || feet > 800) return base;

    // Line to draw along the front eave.
    const toLngLat = (u: number, v: number) => fromLocal(center, u * fx - v * fy, u * fy + v * fx);
    const line: Array<[number, number]> = Number.isFinite(uMax) ? [toLngLat(uMax, vMin), toLngLat(uMax, vMax)] : [];

    return { ...base, feet, source: "satellite", line: line.length ? line : null, imageCenter: [center.lng, center.lat] };
  } catch (err) {
    console.error("[quote] satellite measurement failed:", err);
    return base;
  }
}
