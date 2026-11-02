"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Send, CheckCircle, AlertCircle, Trash2, Download, GitMerge } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  getInvoiceTotal,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/data";
import { useData } from "@/lib/data-context";
import { useLocation } from "@/lib/location-context";
import { formatDateOnly, todayDateKey, toDateKey } from "@/lib/dates";
import { sendInvoice } from "./actions";
import { InvoiceCSVImportDialog } from "@/components/invoices/invoice-csv-import-dialog";

const ALL_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Paid", "Overdue"];

export default function InvoicesPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | InvoiceStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingSend, setPendingSend] = useState<Invoice | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const { loading, invoices: allInvoices, estimates: allEstimates, getCustomerById, refresh } = useData();
  const { selectedLocationId } = useLocation();
  const invoices = selectedLocationId
    ? allInvoices.filter((i) => i.locationId === selectedLocationId)
    : allInvoices;
  const estimates = selectedLocationId
    ? allEstimates.filter((estimate) => estimate.locationId === selectedLocationId)
    : allEstimates;

  const filtered = invoices.filter((inv) => {
    const customer = getCustomerById(inv.customerId);
    const matchesQuery =
      inv.invoiceNumber.toLowerCase().includes(query.toLowerCase()) ||
      customer?.name.toLowerCase().includes(query.toLowerCase());
    const matchesTab = activeTab === "all" || inv.status === activeTab;
    return matchesQuery && matchesTab;
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const todayKey = todayDateKey();
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const totalSent = invoices.reduce(
    (sum, invoice) => sum + Math.max(getInvoiceTotal(invoice) - invoice.amountPaid, 0),
    0,
  );
  const totalOverdue = invoices.reduce((sum, invoice) => {
    const dueKey = toDateKey(invoice.dueDate);
    const isPastDue = dueKey && dueKey < todayKey;
    const isUnpaid = invoice.amountPaid < getInvoiceTotal(invoice);
    return sum + (isPastDue && isUnpaid ? Math.max(getInvoiceTotal(invoice) - invoice.amountPaid, 0) : 0);
  }, 0);
  const pendingEstimates = estimates.filter((estimate) =>
    estimate.status === "Draft" || estimate.status === "Sent",
  ).length;

  const counts: Record<string, number> = {
    all: invoices.length,
    Draft: invoices.filter((i) => i.status === "Draft").length,
    Sent: invoices.filter((i) => i.status === "Sent").length,
    Paid: invoices.filter((i) => i.status === "Paid").length,
    Overdue: invoices.filter((i) => i.status === "Overdue").length,
  };

  const handleSelectInvoice = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((inv) => inv.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleDelete = () => {
    if (confirm(`Delete ${selectedIds.size} invoice(s)? This action cannot be undone.`)) {
      // TODO: Implement delete action
      setSelectedIds(new Set());
    }
  };

  const handleExport = () => {
    const selectedInvoices = filtered.filter((inv) => selectedIds.has(inv.id));
    const csv = [
      ["Invoice#", "Customer", "Issued", "Due", "Amount", "Status"],
      ...selectedInvoices.map((inv) => {
        const customer = getCustomerById(inv.customerId);
        const total = getInvoiceTotal(inv);
        return [
          inv.invoiceNumber,
          customer?.name || "",
          formatDateOnly(inv.issuedDate, { month: "short", day: "numeric", year: "numeric" }, ""),
          formatDateOnly(inv.dueDate, { month: "short", day: "numeric", year: "numeric" }, ""),
          total.toString(),
          inv.status,
        ];
      }),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-export-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleMerge = () => {
    if (selectedIds.size < 2) {
      alert("Please select at least 2 invoices to merge");
      return;
    }
    // TODO: Implement merge action
    alert("Merge functionality coming soon");
  };

  const pendingCustomer = pendingSend ? getCustomerById(pendingSend.customerId) : undefined;

  async function confirmSend() {
    if (!pendingSend) return;
    setSending(true);
    try {
      const result = await sendInvoice(pendingSend.id);
      if (!result.ok) {
        setToast({ ok: false, text: result.error });
      } else {
        const who = getCustomerById(pendingSend.customerId)?.email;
        setToast({ ok: true, text: who ? `Invoice emailed to ${who}.` : "Invoice emailed." });
        await refresh();
      }
    } catch (err) {
      setToast({ ok: false, text: err instanceof Error ? err.message : "Failed to send invoice." });
    } finally {
      setSending(false);
      setPendingSend(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Invoices"
        description={`${invoices.length} total invoices`}
        actions={
          <div className="flex gap-2">
            <InvoiceCSVImportDialog />
            <Button size="sm" render={<Link href="/invoices/new" />}>
              <Plus className="size-3.5" data-icon="inline-start" />
              New Invoice
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
          <StatCard
            title="Total Collected"
            value={`$${totalPaid.toLocaleString()}`}
            icon={CheckCircle}
            accent
          />
          <StatCard
            title="Awaiting Payment"
            value={`$${totalSent.toLocaleString()}`}
            icon={Send}
            trendLabel={`${counts.Sent} invoices`}
          />
          <StatCard
            title="Overdue"
            value={`$${totalOverdue.toLocaleString()}`}
            icon={AlertCircle}
            trend="down"
            trendLabel={`${counts.Overdue} overdue`}
          />
          <StatCard
            title="Pending Estimates"
            value={pendingEstimates}
            icon={Send}
            trendLabel="Draft or sent"
          />
        </div>

        {/* Filters and Selection Actions */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Selection Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleExport}
                  className="gap-2"
                >
                  <Download className="size-3.5" />
                  Export
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleMerge}
                  className="gap-2"
                  disabled={selectedIds.size < 2}
                >
                  <GitMerge className="size-3.5" />
                  Merge
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "all" | InvoiceStatus)}
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

          {(["all", ...ALL_STATUSES] as ("all" | InvoiceStatus)[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              {/* Desktop */}
              <div className="hidden md:block">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs uppercase tracking-wide text-muted-foreground">
                          <TableHead className="w-12">
                            <Checkbox
                              checked={filtered.length > 0 && selectedIds.size === filtered.length}
                              aria-label="Select all visible invoices"
                              onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                            />
                          </TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Issued</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((inv) => {
                          const customer = getCustomerById(inv.customerId);
                          const total = getInvoiceTotal(inv);
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="w-12">
                                <Checkbox
                                  checked={selectedIds.has(inv.id)}
                                  onChange={(e) => handleSelectInvoice(inv.id, e.currentTarget.checked)}
                                />
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                <div>{inv.invoiceNumber}</div>
                                {inv.title && inv.title !== inv.invoiceNumber && (
                                  <div className="max-w-56 truncate text-xs font-normal text-muted-foreground">{inv.title}</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="size-7">
                                    <AvatarFallback className="bg-accent text-accent-foreground text-[10px] font-bold">
                                      {customer?.name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">
                                    {customer?.name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDateOnly(inv.issuedDate, { month: "short", day: "numeric", year: "numeric" }, "—")}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDateOnly(inv.dueDate, { month: "short", day: "numeric", year: "numeric" }, "—")}
                              </TableCell>
                              <TableCell className="font-semibold text-sm">
                                ${total.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={inv.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    render={<Link href={`/invoices/${inv.id}`} />}
                                  >
                                    View
                                  </Button>
                                  {(inv.status === "Draft" || inv.status === "Sent") && (
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            aria-label={`Send ${inv.invoiceNumber}`}
                                            onClick={() => setPendingSend(inv)}
                                          />
                                        }
                                      >
                                        <Send className="size-3.5" />
                                        Send
                                      </TooltipTrigger>
                                      <TooltipContent>Email this invoice</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {filtered.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="py-12 text-center text-sm text-muted-foreground"
                            >
                              No invoices found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Mobile */}
              <div className="flex flex-col gap-3 md:hidden">
                {filtered.map((inv) => {
                  const customer = getCustomerById(inv.customerId);
                  const total = getInvoiceTotal(inv);
                  return (
                    <Link key={inv.id} href={`/invoices/${inv.id}`}>
                      <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">
                                {inv.invoiceNumber}
                              </p>
                              {inv.title && inv.title !== inv.invoiceNumber && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{inv.title}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {customer?.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Due{" "}
                                {formatDateOnly(inv.dueDate, { month: "short", day: "numeric", year: "numeric" }, "—")}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-semibold text-sm">
                                ${total.toLocaleString()}
                              </p>
                              <StatusBadge status={inv.status} className="mt-1" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-12">
                    No invoices found
                  </p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
      <AlertDialog open={!!pendingSend} onOpenChange={(open) => { if (!open && !sending) setPendingSend(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send invoice</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCustomer?.email
                ? `Send invoice ${pendingSend?.invoiceNumber} to ${pendingCustomer.email}?`
                : `${pendingCustomer?.name ?? "This customer"} has no email address, so this invoice cannot be emailed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            {pendingCustomer?.email && (
              <Button onClick={confirmSend} disabled={sending}>
                {sending ? "Sending..." : "Send"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {toast && (
        <div
          role={toast.ok ? "status" : "alert"}
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.ok ? "border-border bg-background" : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
