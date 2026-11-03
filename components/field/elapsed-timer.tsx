"use client";

import { useEffect, useState } from "react";

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Live H:MM:SS counter since a timestamp, plus optional already-logged time. */
export function ElapsedTimer({
  since,
  baseMs = 0,
  className,
}: {
  since: string;
  baseMs?: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className={className} aria-live="off">
      {formatElapsed(baseMs + now - new Date(since).getTime())}
    </span>
  );
}
