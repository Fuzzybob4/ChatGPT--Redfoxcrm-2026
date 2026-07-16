"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Send, CheckCircle, AlertCircle, FileText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  getInvoiceTotal,
  type InvoiceStatus,
} from "@/lib/data";
import { useData } from "@/lib/data-context";
import { useLocation } from "@/lib/location-context";
import { InvoiceCSVImportDialog } from "@/components/invoices/invoice-csv-import-dialog";

const ALL_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Paid", "Overdue"];

export default function InvoicesPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | InvoiceStatus>("all");
  const { loading, invoices: allInvoices, getCustomerById } = useData();
  const { selectedLocationId } = useLocation();
  const invoices = selectedLocationId
    ? allInvoices.filter((i) => i.locationId === selectedLocationId)
    : allInvoices;

  const filtered = invoices.filter((inv) => {
    const customer = getCustomerById(inv.customerId);
    const matchesQuery =
      inv.invoiceNumber.toLowerCase().includes(query.toLowerCase()) ||
      customer?.name.toLowerCase().includes(query.toLowerCase());
    const matchesTab = activeTab === "all" || inv.status === activeTab;
    return matchesQuery && matchesTab;
  });

  const totalPaid = invoices
    .filter((i) => i.status === "Paid")
    .reduce((s, i) => s + getInvoiceTotal(i), 0);

  const totalSent = invoices
    .filter((i) => i.status === "Sent")
    .reduce((s, i) => s + getInvoiceTotal(i), 0);

  const totalOverdue = invoices
    .filter((i) => i.status === "Overdue")
    .reduce((s, i) => s + getInvoiceTotal(i), 0);

  const counts: Record<string, number> = {
    all: invoices.length,
    Draft: invoices.filter((i) => i.status === "Draft").length,
    Sent: invoices.filter((i) => i.status === "Sent").length,
    Paid: invoices.filter((i) => i.status === "Paid").length,
    Overdue: invoices.filter((i) => i.status === "Overdue").length,
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
            title="Drafts"
            value={counts.Draft}
            icon={FileText}
            trendLabel="Not yet sent"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
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
                              <TableCell className="font-medium text-sm">
                                {inv.invoiceNumber}
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
                                {new Date(inv.issuedDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric", year: "numeric" }
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(inv.dueDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric", year: "numeric" }
                                )}
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
                                    <Button variant="ghost" size="sm">
                                      <Send className="size-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {filtered.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={7}
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
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {customer?.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Due{" "}
                                {new Date(inv.dueDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric", year: "numeric" }
                                )}
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
    </div>
  );
}
