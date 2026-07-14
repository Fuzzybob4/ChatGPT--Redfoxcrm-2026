"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Search, CalendarDays, LayoutList, Navigation, Play,
  CheckCircle2, Plus, Users, Truck, Wrench, MapPin, Clock,
  ChevronLeft, ChevronRight, MoreVertical, AlertTriangle, Scissors,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { type Job, type JobStatus } from "@/lib/data";
import { useData, type Employee } from "@/lib/data-context";
import { useLocation } from "@/lib/location-context";
import { updateJobStatus, reassignJob, createRemovalJob } from "./actions";

// ── Constants ──────────────────────────────────────────────────────────────

const ALL_STATUSES: JobStatus[] = ["Scheduled", "En Route", "In Progress", "Completed", "Cancelled"];

const STATUS_STYLES: Record<JobStatus, { dot: string; badge: string; label: string }> = {
  Scheduled:     { dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border-blue-200",       label: "Scheduled" },
  "En Route":    { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-700 border-amber-200",    label: "En Route" },
  "In Progress": { dot: "bg-orange-500",  badge: "bg-orange-50 text-orange-700 border-orange-200", label: "In Progress" },
  Completed:     { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Completed" },
  Cancelled:     { dot: "bg-red-400",     badge: "bg-red-50 text-red-600 border-red-200",           label: "Cancelled" },
};

const JOB_TYPE_STYLES: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  install: { icon: Truck,    label: "Install", color: "bg-blue-100 text-blue-800 border-blue-200" },
  removal: { icon: Scissors, label: "Removal", color: "bg-purple-100 text-purple-800 border-purple-200" },
  other:   { icon: Wrench,   label: "Service", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Helpers ────────────────────────────────────────────────────────────────

function nextStatus(current: JobStatus): { label: string; value: "en_route" | "in_progress" | "completed" } | null {
  if (current === "Scheduled")    return { label: "En Route",     value: "en_route" };
  if (current === "En Route")     return { label: "Start Job",    value: "in_progress" };
  if (current === "In Progress")  return { label: "Complete Job", value: "completed" };
  return null;
}

function nextButtonStyle(status: JobStatus): string {
  if (status === "Scheduled")    return "bg-amber-500 hover:bg-amber-600 text-white border-0";
  if (status === "En Route")     return "bg-orange-500 hover:bg-orange-600 text-white border-0";
  if (status === "In Progress")  return "bg-emerald-600 hover:bg-emerald-700 text-white border-0";
  return "";
}

function nextButtonIcon(status: JobStatus): React.ElementType {
  if (status === "Scheduled")   return Navigation;
  if (status === "En Route")    return Play;
  return CheckCircle2;
}

// ── Work Order Card ────────────────────────────────────────────────────────

function WorkOrderCard({
  job,
  customerName,
  employees,
  onRefresh,
}: {
  job: Job;
  customerName: string;
  employees: Employee[];
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [removalOpen, setRemovalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [removalDate, setRemovalDate] = useState("");
  const [removalTime, setRemovalTime] = useState("08:00");
  const [removalEndTime, setRemovalEndTime] = useState("12:00");

  const next = nextStatus(job.status);
  const typeConfig = JOB_TYPE_STYLES[job.jobType] ?? JOB_TYPE_STYLES.other;
  const TypeIcon = typeConfig.icon;
  const statusStyle = STATUS_STYLES[job.status];

  function handleAdvance() {
    if (!next) return;
    startTransition(async () => {
      await updateJobStatus(job.id, next.value);
      onRefresh();
    });
  }

  function handleReassign() {
    if (!selectedEmployee) return;
    const emp = employees.find((e) => e.id === selectedEmployee);
    startTransition(async () => {
      await reassignJob(job.id, emp?.crewName ?? emp?.fullName ?? "", [selectedEmployee]);
      onRefresh();
      setReassignOpen(false);
    });
  }

  function handleCreateRemoval() {
    if (!removalDate) return;
    startTransition(async () => {
      await createRemovalJob(job.id, removalDate, removalTime, removalEndTime);
      onRefresh();
      setRemovalOpen(false);
    });
  }

  const NextIcon = next ? nextButtonIcon(job.status) : null;
  const address = [job.address, job.city].filter(Boolean).join(", ");
  const timeLabel = job.scheduledTime ? job.scheduledTime.slice(0, 5) : null;

  return (
    <>
      <Card className="border-border">
        <CardContent className="p-4">

          {/* Header: type badge + status + menu */}
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <TypeIcon className="size-4 shrink-0 text-muted-foreground" />
              <p className="font-semibold text-sm leading-tight truncate">{job.title}</p>
            </div>
            {/* Always-visible menu — no hover required on mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 shrink-0 -mr-1 -mt-0.5">
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Work order actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Work Order</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setReassignOpen(true)}>
                  <Users className="size-3.5 mr-2" />
                  Reassign crew
                </DropdownMenuItem>
                {job.jobType === "install" && job.status === "Completed" && (
                  <DropdownMenuItem onClick={() => setRemovalOpen(true)}>
                    <Scissors className="size-3.5 mr-2" />
                    Schedule removal
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    startTransition(async () => {
                      await updateJobStatus(job.id, "cancelled");
                      onRefresh();
                    });
                  }}
                >
                  Cancel job
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status + type chips */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusStyle.badge}`}>
              <span className={`size-1.5 rounded-full ${statusStyle.dot}`} />
              {statusStyle.label}
            </span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${typeConfig.color}`}>
              {typeConfig.label}
            </Badge>
          </div>

          {/* Details */}
          <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
            <div className="flex items-center gap-1.5">
              <Users className="size-3 shrink-0" />
              <span className="truncate">{customerName}</span>
            </div>
            {address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{address}</span>
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {timeLabel && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3 shrink-0" />
                  <span>{timeLabel}{job.durationMins ? ` · ${job.durationMins} min` : ""}</span>
                </div>
              )}
              {job.technicianName && (
                <div className="flex items-center gap-1.5">
                  <Wrench className="size-3 shrink-0" />
                  <span className="truncate">{job.technicianName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Active timestamps */}
          {(job.enRouteAt || job.startedAt) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {job.enRouteAt && (
                <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  En route {new Date(job.enRouteAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              {job.startedAt && (
                <p className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                  Started {new Date(job.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
            </div>
          )}

          {/* Primary action — full width, tall touch target */}
          {next && (
            <Button
              className={`w-full h-11 text-sm font-semibold ${nextButtonStyle(job.status)}`}
              onClick={handleAdvance}
              disabled={pending}
            >
              {NextIcon && <NextIcon className="size-4 mr-2" />}
              {pending ? "Updating..." : next.label}
            </Button>
          )}

          {/* Schedule Removal (completed install only) */}
          {job.status === "Completed" && job.jobType === "install" && (
            <Button
              variant="outline"
              className="w-full h-10 text-xs mt-2 border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={() => setRemovalOpen(true)}
            >
              <Scissors className="size-3.5 mr-1.5" />
              Schedule Removal
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Reassign dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-sm mx-4 rounded-xl">
          <DialogHeader>
            <DialogTitle>Reassign Crew</DialogTitle>
            <DialogDescription>
              Choose an employee to take over this work order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={selectedEmployee} onValueChange={(v) => setSelectedEmployee(v ?? "")}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees.filter((e) => e.isActive).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName}{e.crewName ? ` (${e.crewName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!employees.some((e) => e.isActive) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-amber-500" />
                No active employees found. Add employees in the Crew section.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={() => setReassignOpen(false)}>Cancel</Button>
              <Button className="h-11" onClick={handleReassign} disabled={!selectedEmployee || pending}>
                {pending ? "Reassigning..." : "Reassign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule removal dialog */}
      <Dialog open={removalOpen} onOpenChange={setRemovalOpen}>
        <DialogContent className="max-w-sm mx-4 rounded-xl">
          <DialogHeader>
            <DialogTitle>Schedule Removal</DialogTitle>
            <DialogDescription>
              Create a removal work order linked to this install. Customer, address,
              and invoice carry over automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Removal date</label>
              <Input type="date" className="h-11" value={removalDate} onChange={(e) => setRemovalDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start time</label>
                <Input type="time" className="h-11" value={removalTime} onChange={(e) => setRemovalTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">End time</label>
                <Input type="time" className="h-11" value={removalEndTime} onChange={(e) => setRemovalEndTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={() => setRemovalOpen(false)}>Cancel</Button>
              <Button className="h-11" onClick={handleCreateRemoval} disabled={!removalDate || pending}>
                {pending ? "Creating..." : "Create Removal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Calendar view ──────────────────────────────────────────────────────────

function CalendarView({
  query,
  jobs,
  getCustomerById,
}: {
  query: string;
  jobs: Job[];
  getCustomerById: (id: string) => { name: string } | undefined;
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    jobs.forEach((j) => {
      if (!map[j.scheduledDate]) map[j.scheduledDate] = [];
      map[j.scheduledDate].push(j);
    });
    return map;
  }, [jobs]);

  const cells: (string | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const selectedJobs = selectedDay
    ? (jobsByDate[selectedDay] ?? []).filter((j) => {
        const c = getCustomerById(j.customerId);
        const q = query.toLowerCase();
        return j.title.toLowerCase().includes(q) || c?.name.toLowerCase().includes(q);
      })
    : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{MONTH_NAMES[month]} {year}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null); }}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(todayStr); }}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null); }}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Day headers — abbreviated to 1 letter on mobile */}
        <div className="grid grid-cols-7 bg-muted/50">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] sm:text-xs font-medium text-muted-foreground">
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {cells.map((dateStr, idx) => {
            if (!dateStr) return <div key={`empty-${idx}`} className="h-14 sm:h-20 bg-muted/20" />;
            const dayJobs = jobsByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            const dayNum = parseInt(dateStr.split("-")[2]);
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`h-14 sm:h-20 p-1 sm:p-1.5 text-left flex flex-col gap-0.5 sm:gap-1 transition-colors hover:bg-muted/40 active:bg-muted/60 ${isSelected ? "bg-primary/5 ring-1 ring-inset ring-primary" : ""}`}
              >
                <span className={`text-[11px] sm:text-xs font-medium w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full shrink-0 ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {dayNum}
                </span>
                {/* On mobile just show a dot per job, on sm+ show mini label */}
                <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {dayJobs.slice(0, 3).map((j) => (
                      <span key={j.id} className={`inline-block size-1.5 rounded-full ${STATUS_STYLES[j.status].dot}`} />
                    ))}
                    {dayJobs.length > 3 && <span className="text-[8px] text-muted-foreground">+{dayJobs.length - 3}</span>}
                  </div>
                  <div className="hidden sm:flex sm:flex-col sm:gap-0.5">
                    {dayJobs.slice(0, 2).map((j) => (
                      <div key={j.id} className={`text-[9px] leading-tight truncate rounded px-1 py-0.5 border ${STATUS_STYLES[j.status].badge}`}>
                        {j.scheduledTime?.slice(0, 5)} {j.title}
                      </div>
                    ))}
                    {dayJobs.length > 2 && <span className="text-[10px] text-muted-foreground pl-1">+{dayJobs.length - 2}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day jobs */}
      {selectedDay && (
        <div>
          <p className="text-sm font-semibold mb-3">
            {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {selectedJobs.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""}</span>
            )}
          </p>
          {selectedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No work orders on this day.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedJobs.map((j) => (
                <Card key={j.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-tight">{j.title}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLES[j.status].badge}`}>{j.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{getCustomerById(j.customerId)?.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<JobStatus, number> = {
  "En Route": 0, "In Progress": 1, Scheduled: 2, Completed: 3, Cancelled: 4,
};

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<"all" | JobStatus>("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const { loading, jobs: allJobs, getCustomerById, employees, refresh } = useData();
  const { selectedLocationId } = useLocation();

  const jobs = useMemo(
    () => (selectedLocationId ? allJobs.filter((j) => j.locationId === selectedLocationId) : allJobs),
    [allJobs, selectedLocationId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      const customer = getCustomerById(j.customerId);
      const matchesQuery =
        !q ||
        j.title.toLowerCase().includes(q) ||
        (customer?.name ?? "").toLowerCase().includes(q) ||
        j.technicianName.toLowerCase().includes(q) ||
        j.address.toLowerCase().includes(q);
      const matchesStatus = activeStatus === "all" || j.status === activeStatus;
      return matchesQuery && matchesStatus;
    });
  }, [jobs, query, activeStatus, getCustomerById]);

  const byDate = useMemo(
    () =>
      filtered.reduce<Record<string, Job[]>>((acc, job) => {
        const d = job.scheduledDate;
        if (!acc[d]) acc[d] = [];
        acc[d].push(job);
        return acc;
      }, {}),
    [filtered],
  );

  const sortedDates = Object.keys(byDate).sort();

  const counts: Record<string, number> = {
    all: jobs.length,
    Scheduled: jobs.filter((j) => j.status === "Scheduled").length,
    "En Route": jobs.filter((j) => j.status === "En Route").length,
    "In Progress": jobs.filter((j) => j.status === "In Progress").length,
    Completed: jobs.filter((j) => j.status === "Completed").length,
    Cancelled: jobs.filter((j) => j.status === "Cancelled").length,
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Work Orders"
        description={`${jobs.length} total work orders`}
        actions={
          <Button size="sm" disabled>
            <Plus className="size-3.5 mr-1.5" />
            New
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search jobs, customers, crew..."
              className="pl-9 h-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30 self-start sm:self-auto shrink-0">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <LayoutList className="size-4" />
              <span>List</span>
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${view === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <CalendarDays className="size-4" />
              <span>Calendar</span>
            </button>
          </div>
        </div>

        {view === "calendar" && (
          <CalendarView query={query} jobs={jobs} getCustomerById={getCustomerById} />
        )}

        {view === "list" && (
          <div className="space-y-4">
            {/* Status filter — horizontal scroll on mobile */}
            <div className="-mx-4 px-4 lg:mx-0 lg:px-0">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {(["all", ...ALL_STATUSES] as ("all" | JobStatus)[]).map((s) => {
                  const cnt = counts[s] ?? 0;
                  const isActive = activeStatus === s;
                  const dot = s !== "all" ? STATUS_STYLES[s as JobStatus].dot : undefined;
                  return (
                    <button
                      key={s}
                      onClick={() => setActiveStatus(s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors shrink-0 ${
                        isActive
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                      }`}
                    >
                      {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
                      {s === "all" ? "All" : s} ({cnt})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Job list */}
            {sortedDates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No work orders found.</p>
            ) : (
              <div className="space-y-8">
                {sortedDates.map((date) => {
                  const dayJobs = [...byDate[date]].sort(
                    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
                  );
                  return (
                    <div key={date}>
                      <div className="flex items-center gap-3 mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {dayJobs.length} order{dayJobs.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {dayJobs.map((job) => {
                          const customer = getCustomerById(job.customerId);
                          return (
                            <WorkOrderCard
                              key={job.id}
                              job={job}
                              customerName={customer?.name ?? "Unknown Customer"}
                              employees={employees}
                              onRefresh={refresh}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
