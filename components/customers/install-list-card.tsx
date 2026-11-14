"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ClipboardList, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InstallItems } from "@/components/field/install-items";
import {
  getCustomerInstallList,
  saveCustomerInstallList,
  type InstallListView,
} from "@/app/(crm)/customers/install-list-actions";

interface Row {
  name: string;
  qty: string;
  details: string;
}

const toRows = (view: InstallListView): Row[] =>
  view.items.map((i) => {
    const [name = "", ...rest] = i.description.split("\n");
    return { name: name.trim(), qty: String(i.quantity ?? 1), details: rest.join("\n").trim() };
  });

export function InstallListCard({ customerId }: { customerId: string }) {
  const [view, setView] = useState<InstallListView | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null); // non-null = editing
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    getCustomerInstallList(customerId)
      .then((v) => alive && setView(v))
      .catch(() => alive && setView({ items: [], custom: false, canEdit: false }));
    return () => {
      alive = false;
    };
  }, [customerId]);

  const update = (idx: number, patch: Partial<Row>) =>
    setRows((r) => (r ? r.map((row, i) => (i === idx ? { ...row, ...patch } : row)) : r));
  const move = (idx: number, dir: -1 | 1) =>
    setRows((r) => {
      if (!r) return r;
      const j = idx + dir;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  function save(items: Row[] | null) {
    setError(null);
    start(async () => {
      const res = await saveCustomerInstallList(
        customerId,
        items === null
          ? null
          : items
              .filter((r) => r.name.trim())
              .map((r) => ({
                description: [r.name.trim(), r.details.trim()].filter(Boolean).join("\n"),
                quantity: Number(r.qty) > 0 ? Number(r.qty) : 1,
              })),
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setView(res.view);
      setRows(null);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="size-4 text-primary" />
            Install list &amp; materials
          </CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            {view?.custom
              ? "Edited by the office for this season. The crew sees this list on the job, without prices."
              : "From this season's estimate or invoice. The crew sees this same list on the job, without prices."}
          </CardDescription>
        </div>
        {view?.canEdit && rows === null && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setRows(view.items.length ? toRows(view) : [{ name: "", qty: "1", details: "" }])}
          >
            <Pencil className="size-3.5" data-icon="inline-start" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {view === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows === null ? (
          <InstallItems
            bare
            items={view.items}
            emptyText="No items yet. Tap Edit to add them, or they'll come in from this season's estimate or invoice."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row, idx) => (
              <div key={idx} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input
                    value={row.name}
                    onChange={(e) => update(idx, { name: e.target.value })}
                    placeholder="Item (e.g. Front roof line)"
                    className="flex-1 font-medium"
                    aria-label="Item"
                  />
                  <Input
                    value={row.qty}
                    onChange={(e) => update(idx, { qty: e.target.value })}
                    inputMode="decimal"
                    className="w-20"
                    aria-label="Quantity"
                    placeholder="Qty"
                  />
                </div>
                <Textarea
                  value={row.details}
                  onChange={(e) => update(idx, { details: e.target.value })}
                  placeholder="Details for the crew (bulb type, colors, where it goes)"
                  rows={2}
                  aria-label="Details"
                />
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up">
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} aria-label="Move down">
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setRows((r) => (r ? r.filter((_, i) => i !== idx) : r))}
                    aria-label="Remove item"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="self-start" onClick={() => setRows((r) => [...(r ?? []), { name: "", qty: "1", details: "" }])}>
              <Plus className="size-3.5" data-icon="inline-start" />
              Add item
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              {view.custom ? (
                <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={() => save(null)}>
                  Reset to invoice list
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Doesn&apos;t change the invoice or Square.</span>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => { setRows(null); setError(null); }}>
                  Cancel
                </Button>
                <Button size="sm" disabled={pending} onClick={() => save(rows)}>
                  {pending && <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
