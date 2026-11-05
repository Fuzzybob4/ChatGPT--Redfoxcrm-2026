"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, RotateCcw } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateCustomerStage } from "@/app/(crm)/customers/actions";
import {
  LIFECYCLE_META,
  MANUAL_DISPOSITIONS,
  isManualStage,
  type LifecycleStatus,
} from "@/lib/lifecycle";
import { cn } from "@/lib/utils";

const SEASONAL_STAGES = ["pending_install", "installed", "pending_removal", "removed"] as const;

interface Props {
  customerId: string;
  /** The stage currently in effect (automatic or manual). */
  stage: LifecycleStatus;
  /** The stored manual override, if any. */
  override: string | null | undefined;
  onChanged?: () => void | Promise<void>;
}

export function LifecycleStageControl({ customerId, stage, override, onChanged }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const meta = LIFECYCLE_META[stage];
  const isManual = isManualStage(override ?? "");

  const choose = (next: string | null) => {
    setError(null);
    startTransition(async () => {
      try {
        await updateCustomerStage(customerId, next);
        await onChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update stage.");
      }
    });
  };

  const renderItem = (value: LifecycleStatus) => {
    const itemMeta = LIFECYCLE_META[value];
    const active = isManual && override === value;
    return (
      <DropdownMenuItem
        key={value}
        onClick={() => choose(value)}
        className="flex min-h-11 items-center gap-2.5"
      >
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: itemMeta.color }} />
        <span className="flex flex-1 flex-col">
          <span className="text-sm font-medium">{itemMeta.label}</span>
          <span className="text-xs text-muted-foreground">{itemMeta.description}</span>
        </span>
        {active && <Check className="size-4 text-primary" />}
      </DropdownMenuItem>
    );
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          aria-label={`Customer stage: ${meta.label}. Change stage`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          style={{ backgroundColor: meta.color }}
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <span className="inline-block size-1.5 rounded-full bg-white/90" />
          )}
          {meta.label}
          <ChevronDown className="size-3.5 opacity-90" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Automatic tracking</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => choose(null)}
              className="flex min-h-11 items-center gap-2.5"
            >
              <RotateCcw className="size-4 text-muted-foreground" />
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-medium">Auto</span>
                <span className="text-xs text-muted-foreground">Follow deposits and jobs</span>
              </span>
              {!isManual && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Install stage</DropdownMenuLabel>
            {SEASONAL_STAGES.map(renderItem)}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Disposition</DropdownMenuLabel>
            {MANUAL_DISPOSITIONS.map(renderItem)}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {error ?? (isManual ? "Set manually" : meta.description)}
      </span>
    </div>
  );
}
