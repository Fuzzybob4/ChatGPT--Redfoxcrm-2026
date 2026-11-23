"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface ViewerPhoto {
  src: string;
  caption?: string;
  date?: string;
}

/**
 * Full-screen photo viewer for phones: fills the screen in portrait or
 * landscape, pinch or double-tap to zoom, drag to look around, swipe to go
 * to the next photo.
 */
export function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: ViewerPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [chrome, setChrome] = useState(true);
  const g = useRef({
    pinchDist: 0,
    pinchScale: 1,
    panStart: { x: 0, y: 0 },
    posStart: { x: 0, y: 0 },
    swipeX: 0,
    moved: false,
    lastTap: 0,
    touches: 0,
  });
  const stage = useRef<HTMLDivElement>(null);
  const state = useRef({ scale, pos });
  state.current = { scale, pos };

  const photo = photos[index];
  const reset = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };
  const go = useCallback(
    (d: number) => {
      reset();
      onIndex((index + d + photos.length) % photos.length);
    },
    [index, onIndex, photos.length],
  );

  // Lock the page behind, and keyboard support on a computer.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", key);
    };
  }, [go, onClose]);

  // Touch gestures (non-passive so the browser doesn't scroll or zoom the page).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      const s = g.current;
      s.touches = e.touches.length;
      s.moved = false;
      if (e.touches.length === 2) {
        s.pinchDist = dist(e.touches);
        s.pinchScale = state.current.scale;
      } else if (e.touches.length === 1) {
        s.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        s.posStart = state.current.pos;
        s.swipeX = 0;
      }
    };
    const move = (e: TouchEvent) => {
      e.preventDefault();
      const s = g.current;
      s.moved = true;
      if (e.touches.length === 2 && s.pinchDist) {
        const next = Math.min(5, Math.max(1, (s.pinchScale * dist(e.touches)) / s.pinchDist));
        setScale(next);
        if (next === 1) setPos({ x: 0, y: 0 });
      } else if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - s.panStart.x;
        const dy = e.touches[0].clientY - s.panStart.y;
        if (state.current.scale > 1) setPos({ x: s.posStart.x + dx, y: s.posStart.y + dy });
        else s.swipeX = dx;
      }
    };
    const end = (e: TouchEvent) => {
      const s = g.current;
      if (e.touches.length > 0) return;
      if (s.touches === 1 && !s.moved) {
        const now = Date.now();
        if (now - s.lastTap < 300) {
          // Double-tap: zoom in, or back out.
          if (state.current.scale > 1) reset();
          else setScale(2.5);
          s.lastTap = 0;
        } else {
          s.lastTap = now;
          setTimeout(() => {
            if (g.current.lastTap === now) setChrome((c) => !c);
          }, 300);
        }
      } else if (s.touches === 1 && state.current.scale === 1 && Math.abs(s.swipeX) > 60) {
        go(s.swipeX < 0 ? 1 : -1);
      }
      if (state.current.scale <= 1.02) reset();
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
    };
  }, [go]);

  if (typeof document === "undefined" || !photo) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      className="fixed inset-0 z-[100] bg-black"
      style={{ width: "100vw", height: "100dvh" }}
    >
      <div
        ref={stage}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ touchAction: "none" }}
        onDoubleClick={() => (scale > 1 ? reset() : setScale(2.5))}
      >
        <img
          key={photo.src}
          src={photo.src}
          alt={photo.caption || `Photo ${index + 1}`}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            width: "100%",
            height: "100%",
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: g.current.moved ? "none" : "transform 150ms ease-out",
          }}
        />
      </div>

      {chrome && (
        <>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <p className="min-w-0 truncate text-sm">
              {photo.caption || "Photo"}
              <span className="text-white/70">
                {photo.date ? ` · ${photo.date}` : ""} · {index + 1}/{photos.length}
              </span>
            </p>
            <button type="button" onClick={onClose} aria-label="Close photo"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <X className="size-6" />
            </button>
          </div>
          {photos.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Previous photo"
                className="absolute left-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur">
                <ChevronLeft className="size-7" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Next photo"
                className="absolute right-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur">
                <ChevronRight className="size-7" />
              </button>
            </>
          )}
          {scale === 1 && (
            <p className="pointer-events-none absolute inset-x-0 bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-white/70">
              Pinch or double-tap to zoom · turn your phone for a bigger view
            </p>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
