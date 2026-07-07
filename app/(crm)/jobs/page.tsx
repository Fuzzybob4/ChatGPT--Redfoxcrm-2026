"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Clock,
  User,
  MapPin,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutList,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  jobs,
  getCustomerById,
  getPropertyById,
  type JobStatus,
} from "@/lib/data";

const ALL_STATUSES: JobStatus[] = ["Scheduled", "In Progress", "Completed", "Cancelled"];

const STATUS_DOT: Record<JobStatus, string> = {
  Scheduled: "bg-blue-500",
  "In Progress": "bg-amber-500",
  Completed: "bg-emerald-500",
  Cancelled: "bg-red-400",
};

const SERVICE_COLORS: Record<string, string> = {
  "Lawn Care": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Pest Control": "bg-orange-100 text-orange-800 border-orange-200",
  HVAC: "bg-blue-100 text-blue-800 border-blue-200",
  Cleaning: "bg-violet-100 text-violet-800 border-violet-200",
  "Tree Service": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Pressure Washing": "bg-cyan-100 text-cyan-800 border-cyan-200",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CalendarView({ query }: { query: string }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map YYYY-MM-DD -> jobs on that day
  const jobsByDate = useMemo(() => {
    const map: Record<string, typeof jobs> = {};
    jobs.forEach((j) => {
      if (!map[j.scheduledDate]) map[j.scheduledDate] = [];
      map[j.scheduledDate].push(j);
    });
    return map;
  }, []);

  const cells: (string | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }),
  ];

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedJobs = selectedDay
    ? (jobsByDate[selectedDay] ?? []).filter((j) => {
        const customer = getCustomerById(j.customerId);
        return (
          j.title.toLowerCase().includes(query.toLowerCase()) ||
          customer?.name.toLowerCase().includes(query.toLowerCase())
        );
      })
    : [];

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{MONTH_NAMES[month]} {year}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(todayStr); }}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/50">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        {/* Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {cells.map((dateStr, idx) => {
            if (!dateStr) {
              return <div key={`empty-${idx}`} className="h-20 bg-muted/20" />;
            }
            const dayJobs = jobsByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            const dayNum = parseInt(dateStr.split("-")[2]);

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`h-20 p-1.5 text-left flex flex-col gap-1 transition-colors hover:bg-muted/40 ${
                  isSelected ? "bg-primary/5 ring-1 ring-inset ring-primary" : ""
                }`}
              >
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}>
                  {dayNum}
                </span>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayJobs.slice(0, 3).map((j) => (
                    <div
                      key={j.id}
                      className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 ${
                        j.status === "Completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : j.status === "In Progress"
                          ? "bg-amber-100 text-amber-800"
                          : j.status === "Cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {j.scheduledTime} {j.title}
                    </div>
                  ))}
                  {dayJobs.length > 3 && (
                    <span className="text-[10px] text-muted-foreground pl-1">+{dayJobs.length - 3} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div>
          <h3 className="text-sm font-semibold mb-3">
            {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""}</span>
          </h3>
          {selectedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No jobs scheduled this day.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {selectedJobs.map((job) => {
                const customer = getCustomerById(job.customerId);
                const property = getPropertyById(job.propertyId);
                return (
                  <Card key={job.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="py-3.5 px-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm">{job.title}</p>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><User className="size-3" />{customer?.name}</span>
                        {property && <span className="flex items-center gap-1.5"><MapPin className="size-3" />{property.address}</span>}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5"><Clock className="size-3" />{job.scheduledTime} &middot; {job.durationMins} min</span>
                          <span className="flex items-center gap-1 font-semibold text-foreground"><DollarSign className="size-3" />{job.amount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | JobStatus>("all");
  const [view, setView] = useState<"list" | "calendar">("list");

  const filtered = jobs.filter((j) => {
    const customer = getCustomerById(j.customerId);
    const matchesQuery =
      j.title.toLowerCase().includes(query.toLowerCase()) ||
      customer?.name.toLowerCase().includes(query.toLowerCase()) ||
      j.technicianName.toLowerCase().includes(query.toLowerCase());
    const matchesTab = activeTab === "all" || j.status === activeTab;
    return matchesQuery && matchesTab;
  });

  const byDate = filtered.reduce<Record<string, typeof filtered>>((acc, job) => {
    const d = job.scheduledDate;
    if (!acc[d]) acc[d] = [];
    acc[d].push(job);
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort();

  const counts: Record<string, number> = {
    all: jobs.length,
    Scheduled: jobs.filter((j) => j.status === "Scheduled").length,
    "In Progress": jobs.filter((j) => j.status === "In Progress").length,
    Completed: jobs.filter((j) => j.status === "Completed").length,
    Cancelled: jobs.filter((j) => j.status === "Cancelled").length,
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Jobs &amp; Schedule"
        description={`${jobs.length} total jobs`}
        actions={
          <Button size="sm" render={<Link href="/jobs/new" />}>
            <Plus className="size-3.5" data-icon="inline-start" />
            Schedule Job
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs, customers, technicians..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30 self-start sm:self-auto">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="size-3.5" />
              List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="size-3.5" />
              Calendar
            </button>
          </div>
        </div>

        {/* Calendar view */}
        {view === "calendar" && <CalendarView query={query} />}

        {/* List view */}
        {view === "list" && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "all" | JobStatus)}
            className="space-y-4"
          >
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-3">All ({counts.all})</TabsTrigger>
              {ALL_STATUSES.map((s) => (
                <TabsTrigger key={s} value={s} className="text-xs px-3">
                  <span className={`mr-1.5 inline-block size-1.5 rounded-full ${STATUS_DOT[s]}`} />
                  {s} ({counts[s]})
                </TabsTrigger>
              ))}
            </TabsList>

            {(["all", ...ALL_STATUSES] as ("all" | JobStatus)[]).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-0 space-y-6">
                {sortedDates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-12">No jobs found</p>
                )}
                {sortedDates.map((date) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "long", month: "long", day: "numeric", year: "numeric",
                        })}
                      </p>
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">
                        {byDate[date].length} job{byDate[date].length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {byDate[date].map((job) => {
                        const customer = getCustomerById(job.customerId);
                        const property = getPropertyById(job.propertyId);
                        const colorClass = SERVICE_COLORS[job.serviceType] ?? "bg-muted text-muted-foreground border-border";
                        return (
                          <Card key={job.id} className="hover:border-primary/50 transition-colors cursor-pointer">
                            <CardContent className="py-3.5 px-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="font-medium text-sm truncate">{job.title}</p>
                                <StatusBadge status={job.status} />
                              </div>
                              <Badge variant="outline" className={`text-[11px] px-2 py-0 mb-2.5 border ${colorClass}`}>
                                {job.serviceType}
                              </Badge>
                              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5"><User className="size-3 shrink-0" />{customer?.name}</span>
                                {property && (
                                  <span className="flex items-center gap-1.5"><MapPin className="size-3 shrink-0" />{property.address}, {property.city}</span>
                                )}
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5"><Clock className="size-3 shrink-0" />{job.scheduledTime} &middot; {job.durationMins} min</span>
                                  <span className="flex items-center gap-1 font-semibold text-foreground"><DollarSign className="size-3" />{job.amount}</span>
                                </div>
                                <span>Tech: {job.technicianName}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
