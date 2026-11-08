"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, RotateCcw, Trash2, Spline } from "lucide-react";
import { Button } from "@/components/ui/button";

// Static image size in logical pixels (rendered @2x for sharpness).
const W = 640;
const H = 400;
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const FT_PER_M = 3.28084;

type Pt = [number, number];

/** Meters per logical pixel for a Mapbox (512px tile) image at this zoom and latitude. */
function metersPerPixel(lat: number, zoom: number) {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, zoom));
}

function lineLength(pts: Pt[]) {
  let px = 0;
  for (let i = 1; i < pts.length; i++) px += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return px;
}

/**
 * Tap-to-measure: the user taps each corner of the roofline on a satellite
 * photo and we add up the distance. Separate sections (a detached garage, a
 * second roof edge) can be started with "New section".
 */
export function RooflineTracer({
  token,
  lat,
  lng,
  onFeetChange,
  compact = false,
}: {
  token: string;
  lat: number;
  lng: number;
  onFeetChange?: (feet: number) => void;
  compact?: boolean;
}) {
  const [zoom, setZoom] = useState(19.5);
  const [lines, setLines] = useState<Pt[][]>([[]]);

  const feet = useMemo(() => {
    const mpp = metersPerPixel(lat, zoom);
    return Math.round(lines.reduce((sum, l) => sum + lineLength(l), 0) * mpp * FT_PER_M);
  }, [lines, lat, zoom]);

  useEffect(() => {
    onFeetChange?.(feet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feet]);

  const src = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom},0/${W}x${H}@2x?access_token=${token}`;

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    setLines((ls) => {
      const copy = ls.map((l) => [...l]);
      copy[copy.length - 1].push([x, y]);
      return copy;
    });
  }

  function undo() {
    setLines((ls) => {
      const copy = ls.map((l) => [...l]);
      const last = copy[copy.length - 1];
      if (last.length > 0) last.pop();
      else if (copy.length > 1) copy.pop();
      return copy;
    });
  }

  function changeZoom(delta: number) {
    // Points are in screen pixels, so changing zoom starts the trace over.
    setZoom((z) => Math.min(21, Math.max(18, z + delta)));
    setLines([[]]);
  }

  const hasPoints = lines.some((l) => l.length > 0);
  const colors = ["#ffcc00", "#22d3ee", "#f472b6", "#a3e635"];

  return (
    <div className="space-y-2">
      <div
        className="relative w-full cursor-crosshair overflow-hidden rounded-lg border select-none"
        style={{ aspectRatio: `${W} / ${H}` }}
        onClick={tap}
        role="application"
        aria-label="Tap along the roofline to measure"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Satellite view" className="absolute inset-0 size-full" draggable={false} />
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full">
          {lines.map((l, i) => (
            <g key={i}>
              {l.length > 1 && (
                <polyline
                  points={l.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke={colors[i % colors.length]}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {l.map((p, j) => (
                <circle key={j} cx={p[0]} cy={p[1]} r={4.5} fill={colors[i % colors.length]} stroke="#000" strokeWidth={1} />
              ))}
            </g>
          ))}
        </svg>
        {!hasPoints && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            Tap each corner along the front roofline
          </div>
        )}
        <div className="absolute right-2 top-2 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          <Button type="button" size="icon-xs" variant="secondary" aria-label="Zoom in" onClick={() => changeZoom(0.5)}>
            <Plus className="size-3" />
          </Button>
          <Button type="button" size="icon-xs" variant="secondary" aria-label="Zoom out" onClick={() => changeZoom(-0.5)}>
            <Minus className="size-3" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm">
          Traced: <span className="font-semibold tabular-nums">{feet} ft</span>
        </span>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={undo} disabled={!hasPoints}>
          <RotateCcw className="size-3.5" /> Undo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={lines[lines.length - 1].length < 2}
          onClick={() => setLines((ls) => [...ls, []])}
        >
          <Spline className="size-3.5" /> New section
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setLines([[]])} disabled={!hasPoints}>
          <Trash2 className="size-3.5" /> Clear
        </Button>
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Tip: zoom in first (the + button). Changing zoom clears the line. Use &quot;New section&quot; for a roof edge that
          isn&apos;t connected, like a garage.
        </p>
      )}
    </div>
  );
}
