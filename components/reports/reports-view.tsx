"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Search } from "lucide-react";

type CustomerRef = { full_name: string | null; city: string | null } | null;

type InvoiceRow = {
  id: string;
  invoice_number: string;
  title: string | null;
  status: string;
  total_amount: number;
  amount_paid: number;
  due_date: string | null;
  created_at: string;
  customer: CustomerRef;
};

type EstimateRow = {
  id: string;
  estimate_number: string | null;
  title: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  customer: CustomerRef;
};

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  install_status: string | null;
  status: string | null;
  created_at: string;
};

type ReportType = "invoices" | "estimates" | "customers";

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => esc(r[c])).join(",")),
  ].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n ?? 0
  );

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

const statusVariant = (s: string) => {
  switch (s) {
    case "paid":
    case "approved":
    case "active":
    case "installed":
      return "default" as const;
    case "sent":
    case "pending_install":
    case "pending":
      return "secondary" as const;
    case "overdue":
    case "declined":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

export function ReportsView({
  invoices,
  estimates,
  customers,
}: {
  invoices: InvoiceRow[];
  estimates: EstimateRow[];
  customers: CustomerRow[];
}) {
  const [type, setType] = useState<ReportType>("invoices");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const statusOptions = useMemo(() => {
    const src =
      type === "invoices"
        ? invoices.map((i) => i.status)
        : type === "estimates"
          ? estimates.map((e) => e.status)
          : customers.map((c) => c.install_status ?? "unknown");
    return ["all", ...Array.from(new Set(src))];
  }, [type, invoices, estimates, customers]);

  const inDateRange = (created: string) => {
    if (dateFrom && new Date(created) < new Date(dateFrom)) return false;
    if (dateTo && new Date(created) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  };

  const q = search.toLowerCase();

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (status === "all" || i.status === status) &&
          inDateRange(i.created_at) &&
          (!q ||
            i.invoice_number?.toLowerCase().includes(q) ||
            i.title?.toLowerCase().includes(q) ||
            i.customer?.full_name?.toLowerCase().includes(q))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, status, q, dateFrom, dateTo]
  );

  const filteredEstimates = useMemo(
    () =>
      estimates.filter(
        (e) =>
          (status === "all" || e.status === status) &&
          inDateRange(e.created_at) &&
          (!q ||
            e.estimate_number?.toLowerCase().includes(q) ||
            e.title?.toLowerCase().includes(q) ||
            e.customer?.full_name?.toLowerCase().includes(q))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estimates, status, q, dateFrom, dateTo]
  );

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          (status === "all" || c.install_status === status) &&
          inDateRange(c.created_at) &&
          (!q ||
            c.full_name?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.city?.toLowerCase().includes(q))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, status, q, dateFrom, dateTo]
  );

  const handleExport = () => {
    if (type === "invoices") {
      downloadCsv(
        "invoices-report.csv",
        toCsv(
          filteredInvoices.map((i) => ({
            invoice_number: i.invoice_number,
            title: i.title,
            customer: i.customer?.full_name,
            city: i.customer?.city,
            status: i.status,
            total_amount: i.total_amount,
            amount_paid: i.amount_paid,
            due_date: i.due_date,
            created_at: i.created_at,
          })),
          [
            "invoice_number",
            "title",
            "customer",
            "city",
            "status",
            "total_amount",
            "amount_paid",
            "due_date",
            "created_at",
          ]
        )
      );
    } else if (type === "estimates") {
      downloadCsv(
        "estimates-report.csv",
        toCsv(
          filteredEstimates.map((e) => ({
            estimate_number: e.estimate_number,
            title: e.title,
            customer: e.customer?.full_name,
            city: e.customer?.city,
            status: e.status,
            total_amount: e.total_amount,
            created_at: e.created_at,
          })),
          [
            "estimate_number",
            "title",
            "customer",
            "city",
            "status",
            "total_amount",
            "created_at",
          ]
        )
      );
    } else {
      downloadCsv(
        "customers-report.csv",
        toCsv(
          filteredCustomers.map((c) => ({
            full_name: c.full_name,
            email: c.email,
            phone: c.phone,
            city: c.city,
            state: c.state,
            install_status: c.install_status,
            status: c.status,
            created_at: c.created_at,
          })),
          [
            "full_name",
            "email",
            "phone",
            "city",
            "state",
            "install_status",
            "status",
            "created_at",
          ]
        )
      );
    }
  };

  const count =
    type === "invoices"
      ? filteredInvoices.length
      : type === "estimates"
        ? filteredEstimates.length
        : filteredCustomers.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Filters bar */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v as ReportType);
              setStatus("all");
            }}
          >
            <TabsList>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="estimates">Estimates</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, number, or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All statuses" : s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full md:w-40"
              aria-label="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full md:w-40"
              aria-label="To date"
            />
            <Button onClick={handleExport} className="gap-2">
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "record" : "records"} found
          </p>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {type === "invoices" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 font-medium">Invoice #</th>
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">City</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Total</th>
                  <th className="p-3 font-medium text-right">Paid</th>
                  <th className="p-3 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                    <td className="p-3 font-medium">{i.invoice_number}</td>
                    <td className="p-3">{i.customer?.full_name ?? "—"}</td>
                    <td className="p-3">{i.customer?.city ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={statusVariant(i.status)}>{i.status}</Badge>
                    </td>
                    <td className="p-3 text-right">{fmtMoney(i.total_amount)}</td>
                    <td className="p-3 text-right">{fmtMoney(i.amount_paid)}</td>
                    <td className="p-3">{fmtDate(i.due_date)}</td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No invoices match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {type === "estimates" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 font-medium">Estimate #</th>
                  <th className="p-3 font-medium">Title</th>
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Total</th>
                  <th className="p-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredEstimates.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                    <td className="p-3 font-medium">{e.estimate_number ?? "—"}</td>
                    <td className="p-3">{e.title ?? "—"}</td>
                    <td className="p-3">{e.customer?.full_name ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
                    </td>
                    <td className="p-3 text-right">{fmtMoney(e.total_amount)}</td>
                    <td className="p-3">{fmtDate(e.created_at)}</td>
                  </tr>
                ))}
                {filteredEstimates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No estimates match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {type === "customers" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">City</th>
                  <th className="p-3 font-medium">Install Status</th>
                  <th className="p-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                    <td className="p-3 font-medium">{c.full_name ?? "—"}</td>
                    <td className="p-3">{c.email ?? "—"}</td>
                    <td className="p-3">{c.phone ?? "—"}</td>
                    <td className="p-3">{c.city ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={statusVariant(c.install_status ?? "")}>
                        {(c.install_status ?? "unknown").replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="p-3">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No customers match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
