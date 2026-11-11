"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

import type { CrewOption } from "@/lib/field-homes";
import {
  cancelFieldWorkOrder,
  createFieldWorkOrder,
  updateFieldWorkOrder,
  type WorkOrderInput,
} from "@/app/field/work-order-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TYPES: { value: WorkOrderInput["jobType"]; label: string }[] = [
  { value: "install", label: "Install" },
  { value: "removal", label: "Removal" },
  { value: "service", label: "Service" },
];

type Props =
  | { mode: "create"; customerId: string; customerName: string; address: string; crew: CrewOption[]; initial: WorkOrderInput }
  | {
      mode: "edit";
      jobId: string;
      customerName: string;
      address: string;
      crew: CrewOption[];
      initial: WorkOrderInput;
      cancellable: boolean;
    };

export function WorkOrderForm(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<WorkOrderInput>(props.initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof WorkOrderInput>(key: K, value: WorkOrderInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleCrew = (id: string) =>
    set(
      "assignedEmployees",
      form.assignedEmployees.includes(id)
        ? form.assignedEmployees.filter((x) => x !== id)
        : [...form.assignedEmployees, id],
    );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createFieldWorkOrder(props.customerId, form)
          : await updateFieldWorkOrder(props.jobId, form);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/field/jobs/${result.jobId}`);
      router.refresh();
    });
  }

  function cancelOrder() {
    if (props.mode !== "edit") return;
    if (!window.confirm("Cancel this work order? The crew will no longer see it.")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelFieldWorkOrder(props.jobId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push("/field");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 px-4 pb-40 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-2 flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>

        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {props.mode === "create" ? "New work order" : "Update work order"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">{props.customerName}</h1>
          {props.address && <p className="text-sm text-muted-foreground">{props.address}</p>}
        </header>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Type</legend>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={form.jobType === t.value}
                onClick={() => set("jobType", t.value)}
                className={cn(
                  "min-h-12 rounded-lg border text-sm font-semibold transition-colors",
                  form.jobType === t.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="wo-date">Date</Label>
          <Input
            id="wo-date"
            type="date"
            required
            value={form.scheduledDate}
            onChange={(e) => set("scheduledDate", e.target.value)}
            className="h-12 text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wo-start">Start</Label>
            <Input
              id="wo-start"
              type="time"
              required
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wo-end">End</Label>
            <Input
              id="wo-end"
              type="time"
              required
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              className="h-12 text-base"
            />
          </div>
        </div>

        <fieldset className="flex flex-col">
          <legend className="mb-2 text-sm font-medium text-foreground">Crew</legend>
          {props.crew.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active crew members yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {props.crew.map((member) => {
                const checked = form.assignedEmployees.includes(member.id);
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleCrew(member.id)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-base text-foreground active:bg-accent"
                    >
                      {member.name}
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-md border",
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {checked && <Check className="size-4" aria-hidden="true" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="wo-notes">Notes for the crew</Label>
          <Textarea
            id="wo-notes"
            rows={4}
            maxLength={2000}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Gate code, roofline details, what to bring..."
            className="text-base"
          />
        </div>

        {props.mode === "edit" && props.cancellable && (
          <button
            type="button"
            onClick={cancelOrder}
            disabled={isPending}
            className="min-h-11 self-start text-sm font-medium text-destructive"
          >
            Cancel this work order
          </button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
            {props.mode === "create" ? "Create work order" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function NotAllowed() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Crew leads only</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Ask the office to set your role to Crew Lead on the Crew page to manage work orders.
      </p>
      <Link href="/field" className="flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
        Back to my jobs
      </Link>
    </div>
  );
}
