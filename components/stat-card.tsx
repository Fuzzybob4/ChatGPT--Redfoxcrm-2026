import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: boolean;
}

export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  trendLabel,
  accent = false,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "border",
        accent && "bg-primary text-primary-foreground border-primary"
      )}
    >
      <CardContent className="pt-5 pb-5 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                accent ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {title}
            </p>
            <p
              className={cn(
                "mt-1.5 text-2xl font-bold leading-none",
                accent ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {value}
            </p>
            {(subtext || trendLabel) && (
              <p
                className={cn(
                  "mt-1.5 text-xs",
                  accent
                    ? "text-primary-foreground/70"
                    : trend === "up"
                    ? "text-emerald-600"
                    : trend === "down"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {trendLabel ?? subtext}
              </p>
            )}
          </div>
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              accent
                ? "bg-primary-foreground/15"
                : "bg-muted"
            )}
          >
            <Icon
              className={cn(
                "size-5",
                accent ? "text-primary-foreground" : "text-primary"
              )}
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
