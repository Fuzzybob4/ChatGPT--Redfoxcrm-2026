"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Navigation, Phone, Search } from "lucide-react";

import type { FieldCustomer } from "@/lib/field";
import { Input } from "@/components/ui/input";
import { directionsUrl, formatDay, jobTypeLabel } from "./format";

export function FieldCustomerList({ customers }: { customers: FieldCustomer[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q));
  }, [customers, query]);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Customers</h1>
        <p className="text-sm text-muted-foreground">Customers on your jobs. Tap one for phone, photos and what to install.</p>
      </div>

      {customers.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or address"
            aria-label="Search customers"
            className="h-11 pl-9 text-base"
          />
        </div>
      )}

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-medium text-foreground">No customers yet</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Customers appear here once the office assigns you to one of their work orders.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No customers match that search.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((c) => {
            const job = c.nextJob ?? c.lastJob;
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`/field/customers/${c.id}`} className="truncate font-semibold text-foreground underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  {c.phone && <p className="text-sm text-foreground">{c.phone}</p>}
                  {c.address && <p className="text-sm leading-snug text-muted-foreground">{c.address}</p>}
                  {job && (
                    <Link href={`/field/customers/${c.id}`} className="mt-1 text-sm font-medium text-primary">
                      {c.nextJob ? "Next" : "Last"}: {jobTypeLabel(job.jobType)} · {formatDay(job.scheduledDate)}
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {c.phone ? (
                    <a
                      href={`tel:${c.phone}`}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-foreground"
                    >
                      <Phone className="size-4" aria-hidden="true" />
                      Call
                    </a>
                  ) : (
                    <span className="flex min-h-11 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                      No phone
                    </span>
                  )}
                  {c.address ? (
                    <a
                      href={directionsUrl(c.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-foreground"
                    >
                      <Navigation className="size-4" aria-hidden="true" />
                      Directions
                    </a>
                  ) : (
                    <span className="flex min-h-11 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                      No address
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
