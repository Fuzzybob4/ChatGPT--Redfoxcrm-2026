import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  JobStatus,
  InvoiceStatus,
  CustomerStatus,
} from "@/lib/data";

type AnyStatus = JobStatus | InvoiceStatus | CustomerStatus;

const statusConfig: Record<
  AnyStatus,
  { label: string; className: string }
> = {
  // Job statuses
  Scheduled: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  },
  "En Route": {
    label: "En Route",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  },
  "In Progress": {
    label: "In Progress",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  },
  Completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  Cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border",
  },
  // Invoice statuses
  Draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
  },
  Sent: {
    label: "Sent",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  },
  Paid: {
    label: "Paid",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  Overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  },
  // Customer statuses
  Active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  Inactive: {
    label: "Inactive",
    className: "bg-muted text-muted-foreground border-border",
  },
  Lead: {
    label: "Lead",
    className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  },
};

interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] font-medium px-2 py-0.5 border",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
