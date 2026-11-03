"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Timer } from "lucide-react";

import type { FieldJob, OpenTimeEntry } from "@/lib/field";
import { cn } from "@/lib/utils";
import { ElapsedTimer } from "./elapsed-timer";
import { STATUS_LABEL, formatClock, formatDay, jobTypeLabel, localToday } from "./format";

interface Section {
  key: string;
  title: string;
  jobs: FieldJob[];
}

export function FieldJobList({
  jobs,
  openEntry,
  firstName,
}: {
  jobs: FieldJob[];
  openEntry: OpenTimeEntry | null;
  firstName: string;
}) {
  const sections = useMemo<Section[]>(() => {
    const today = localToday();
    const active = jobs.filter((j) => j.status === "in_progress" || j.status === "en_route");
    const scheduled = jobs.filter((j) => j.status === "scheduled");
    const doneToday = jobs.filter(
      (j) => j.status === "completed" && j.completedAt && new Date(j.completedAt).toLocaleDateString("en-CA") === today,
    );
    return [
      { key: "active", title: "Right now", jobs: active },
      { key: "overdue", title: "Missed — still open", jobs: scheduled.filter((j) => j.scheduledDate < today) },
      { key: "today", title: "Today", jobs: scheduled.filter((j) => j.scheduledDate === today) },
      { key: "upcoming", title: "Coming up", jobs: scheduled.filter((j) => j.scheduledDate > today) },
      { key: "done", title: "Finished today", jobs: doneToday },
    ].filter((s) => s.jobs.length > 0);
  }, [jobs]);

  const todayCount = useMemo(() => {
    const today = localToday();
    return jobs.filter((j) => j.scheduledDate === today && j.status !== "cancelled").length;
  }, [jobs]);

  return (
    <div className="flex flex-col gap-6 px-4 pb-10 pt-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">Hi, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {todayCount === 0
            ? "No jobs scheduled for today."
            : `${todayCount} job${todayCount === 1 ? "" : "s"} on your schedule today.`}
        </p>
      </div>

      {sections.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-medium text-foreground">No jobs assigned yet</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Work orders show up here when the office taps &quot;Assign crew&quot; on a work order and picks you.
          </p>
        </div>
      )}

      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`section-${section.key}`} className="flex flex-col gap-3">
          <h2
            id={`section-${section.key}`}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {section.title}
          </h2>
          <ul className="flex flex-col gap-3">
            {section.jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} clockedInSince={openEntry?.jobId === job.id ? openEntry.clockIn : null} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function JobCard({ job, clockedInSince }: { job: FieldJob; clockedInSince: string | null }) {
  const active = job.status === "in_progress";
  const done = job.status === "completed";

  return (
    <Link
      href={`/field/jobs/${job.id}`}
      className={cn(
        "flex items-stretch gap-4 rounded-xl border bg-card p-4 transition-colors active:bg-accent",
        active ? "border-primary ring-1 ring-primary" : "border-border",
        done && "opacity-70",
      )}
    >
      <div className="flex w-20 shrink-0 flex-col justify-center border-r border-border pr-3">
        <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatClock(job.startTime) || "Any time"}
        </span>
        <span className="text-xs text-muted-foreground">{formatDay(job.scheduledDate)}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {jobTypeLabel(job.jobType)}
          </span>
          <span className={cn("text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}>
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
        </div>
        <p className="truncate font-semibold text-foreground">{job.customerName}</p>
        {job.address && (
          <p className="flex items-start gap-1 text-sm leading-snug text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{job.address}</span>
          </p>
        )}
        {clockedInSince && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Timer className="size-4" aria-hidden="true" />
            <ElapsedTimer since={clockedInSince} className="font-mono tabular-nums" />
          </p>
        )}
      </div>

      <ChevronRight className="size-5 shrink-0 self-center text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
