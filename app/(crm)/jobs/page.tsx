"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Clock, User, MapPin, DollarSign } from "lucide-react";

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

const ALL_STATUSES: JobStatus[] = [
  "Scheduled",
  "In Progress",
  "Completed",
  "Cancelled",
];

const SERVICE_COLORS: Record<string, string> = {
  "Lawn Care": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Pest Control": "bg-orange-100 text-orange-800 border-orange-200",
  HVAC: "bg-blue-100 text-blue-800 border-blue-200",
  Cleaning: "bg-violet-100 text-violet-800 border-violet-200",
  "Tree Service": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Pressure Washing": "bg-cyan-100 text-cyan-800 border-cyan-200",
};

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | JobStatus>("all");

  const filtered = jobs.filter((j) => {
    const customer = getCustomerById(j.customerId);
    const matchesQuery =
      j.title.toLowerCase().includes(query.toLowerCase()) ||
      customer?.name.toLowerCase().includes(query.toLowerCase()) ||
      j.technicianName.toLowerCase().includes(query.toLowerCase());
    const matchesTab = activeTab === "all" || j.status === activeTab;
    return matchesQuery && matchesTab;
  });

  const byDate = filtered.reduce<Record<string, typeof filtered>>(
    (acc, job) => {
      const d = job.scheduledDate;
      if (!acc[d]) acc[d] = [];
      acc[d].push(job);
      return acc;
    },
    {}
  );

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
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "all" | JobStatus)}
          className="space-y-4"
        >
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">
              All ({counts.all})
            </TabsTrigger>
            {ALL_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs px-3">
                {s} ({counts[s]})
              </TabsTrigger>
            ))}
          </TabsList>

          {(["all", ...ALL_STATUSES] as ("all" | JobStatus)[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0 space-y-6">
              {sortedDates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No jobs found
                </p>
              )}
              {sortedDates.map((date) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {byDate[date].length} job
                      {byDate[date].length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {byDate[date].map((job) => {
                      const customer = getCustomerById(job.customerId);
                      const property = getPropertyById(job.propertyId);
                      const colorClass =
                        SERVICE_COLORS[job.serviceType] ??
                        "bg-muted text-muted-foreground border-border";

                      return (
                        <Card
                          key={job.id}
                          className="hover:border-primary/50 transition-colors cursor-pointer"
                        >
                          <CardContent className="py-3.5 px-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                  {job.title}
                                </p>
                              </div>
                              <StatusBadge status={job.status} />
                            </div>

                            <Badge
                              variant="outline"
                              className={`text-[11px] px-2 py-0 mb-2.5 border ${colorClass}`}
                            >
                              {job.serviceType}
                            </Badge>

                            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <User className="size-3 shrink-0" />
                                {customer?.name}
                              </span>
                              {property && (
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="size-3 shrink-0" />
                                  {property.address}, {property.city}
                                </span>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="size-3 shrink-0" />
                                  {job.scheduledTime} &middot;{" "}
                                  {job.durationMins} min
                                </span>
                                <span className="flex items-center gap-1 font-semibold text-foreground">
                                  <DollarSign className="size-3" />
                                  {job.amount}
                                </span>
                              </div>
                              <span className="text-muted-foreground">
                                Tech: {job.technicianName}
                              </span>
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
      </div>
    </div>
  );
}
