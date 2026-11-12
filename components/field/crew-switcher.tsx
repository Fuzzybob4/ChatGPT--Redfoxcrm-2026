"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { setHelpingCrew } from "@/app/field/actions";

/** "Working with ___ today": lets anyone join another crew for the day. */
export function CrewSwitcher({
  crews,
  currentCrewId,
  homeCrewId,
}: {
  crews: { id: string; name: string }[];
  currentCrewId: string | null;
  homeCrewId: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const helping = currentCrewId && currentCrewId !== homeCrewId;

  return (
    <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${helping ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-border bg-card"}`}>
      {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <Users className="size-4 shrink-0 text-muted-foreground" />}
      <span className="shrink-0 text-sm text-muted-foreground">Working with</span>
      <select
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
        value={currentCrewId ?? ""}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setHelpingCrew(e.target.value || null);
            router.refresh();
          })
        }
      >
        {!currentCrewId && <option value="">Pick a crew</option>}
        {crews.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.id === homeCrewId ? " (my crew)" : " today"}
          </option>
        ))}
      </select>
    </label>
  );
}
