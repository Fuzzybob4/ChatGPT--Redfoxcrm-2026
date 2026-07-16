"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Settings2,
  Download,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Merge,
  Trash2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { mergeCustomers } from "@/app/(crm)/customers/merge-actions";
import type { Customer } from "@/lib/data";

interface CustomersDataTableProps {
  customers: Customer[];
  onRefresh?: () => void;
}

type SortField = "name" | "email" | "status" | "createdAt";
type SortOrder = "asc" | "desc";

const VISIBLE_COLUMNS_DEFAULT = [
  "name",
  "email",
  "phone",
  "location",
  "status",
  "since",
];

const ALL_COLUMNS = [
  { id: "name", label: "Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "location", label: "Location" },
  { id: "status", label: "Status" },
  { id: "since", label: "Since" },
];

export function CustomersDataTable({ customers, onRefresh }: CustomersDataTableProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [visibleColumns, setVisibleColumns] = useState<(typeof ALL_COLUMNS)[number]["id"][]>(
    VISIBLE_COLUMNS_DEFAULT as (typeof ALL_COLUMNS)[number]["id"][]
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [isMerging, setIsMerging] = useState(false);
  const [pageSize, setPageSize] = useState(25);

  // Filter customers
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers.filter((c) => {
      if (!q) return true;
      const tags: string[] = (c as any).tags ?? [];
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery]);

  // Sort customers
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let aVal: any = a[sortField as keyof Customer];
      let bVal: any = b[sortField as keyof Customer];

      if (sortField === "createdAt") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortField, sortOrder]);

  // Paginate
  const totalPages = Math.ceil(sorted.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const paged = sorted.slice(startIdx, startIdx + pageSize);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((c) => c !== columnId)
        : [...prev, columnId]
    );
  };

  const toggleRowSelection = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllRows = () => {
    if (selectedRows.size === paged.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paged.map((c) => c.id)));
    }
  };

  const handleMergeCustomers = async () => {
    if (selectedRows.size < 2) {
      alert("Please select at least 2 customers to merge");
      return;
    }

    const selectedCustomers = sorted.filter((c) => selectedRows.has(c.id));
    const confirmMessage = `Merge ${selectedRows.size} customers?\n\nCustomers to merge:\n${selectedCustomers
      .map((c) => `- ${c.name} (${c.email})`)
      .join("\n")}\n\nThe first customer will be kept as the primary record.\nAll data from other customers will be moved to the primary.`;

    if (confirm(confirmMessage)) {
      setIsMerging(true);
      try {
        const result = await mergeCustomers(Array.from(selectedRows));
        alert(result.message);
        setSelectedRows(new Set());
        if (onRefresh) {
          onRefresh();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        alert(`Failed to merge customers: ${errorMessage}`);
      } finally {
        setIsMerging(false);
      }
    }
  };

  const handleDeleteCustomers = () => {
    if (selectedRows.size === 0) return;

    const confirmMessage = `Delete ${selectedRows.size} customer(s)? This action cannot be undone.`;
    if (confirm(confirmMessage)) {
      // TODO: Implement delete logic via API
      console.log("[v0] Delete customers:", Array.from(selectedRows));
      alert("Delete functionality coming soon. Selected IDs: " + Array.from(selectedRows).join(", "));
      setSelectedRows(new Set());
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="size-4" />
              Export
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings2 className="size-4" />
                  Columns
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-48">
                {ALL_COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={visibleColumns.includes(col.id)}
                    onCheckedChange={() => toggleColumnVisibility(col.id)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Selection Action Bar */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium text-foreground">
              {selectedRows.size} customer{selectedRows.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMergeCustomers}
                disabled={selectedRows.size < 2 || isMerging}
                className="gap-2"
              >
                {isMerging && <div className="size-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
                {!isMerging && <Merge className="size-3.5" />}
                {isMerging ? "Merging..." : "Merge"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteCustomers}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedRows.size === paged.length && paged.length > 0}
                      onChange={toggleAllRows}
                    />
                  </TableHead>

                  {visibleColumns.includes("name") && (
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 px-4 py-3"
                      onClick={() => toggleSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        Name
                        {sortField === "name" ? (
                          sortOrder === "asc" ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )
                        ) : (
                          <ArrowUpDown className="size-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                  )}

                  {visibleColumns.includes("email") && (
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 px-4 py-3"
                      onClick={() => toggleSort("email")}
                    >
                      <div className="flex items-center gap-2">
                        Email
                        {sortField === "email" ? (
                          sortOrder === "asc" ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )
                        ) : (
                          <ArrowUpDown className="size-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                  )}

                  {visibleColumns.includes("phone") && (
                    <TableHead className="px-4 py-3">Phone</TableHead>
                  )}

                  {visibleColumns.includes("location") && (
                    <TableHead className="px-4 py-3">Location</TableHead>
                  )}

                  {visibleColumns.includes("status") && (
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 px-4 py-3"
                      onClick={() => toggleSort("status")}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {sortField === "status" ? (
                          sortOrder === "asc" ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )
                        ) : (
                          <ArrowUpDown className="size-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                  )}

                  {visibleColumns.includes("since") && (
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 px-4 py-3"
                      onClick={() => toggleSort("createdAt")}
                    >
                      <div className="flex items-center gap-2">
                        Since
                        {sortField === "createdAt" ? (
                          sortOrder === "asc" ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )
                        ) : (
                          <ArrowUpDown className="size-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                  )}

                  <TableHead className="w-20 px-4 py-3 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50">
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedRows.has(customer.id)}
                        onChange={() => toggleRowSelection(customer.id)}
                      />
                    </TableCell>

                    {visibleColumns.includes("name") && (
                      <TableCell className="px-4 py-3">
                        <Link href={`/customers/${customer.id}`} className="block hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 shrink-0">
                              <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                                {customer.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <span className="font-medium text-sm block">{customer.name}</span>
                              {((customer as any).tags ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {((customer as any).tags as string[]).slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-[10px] h-4 px-1 py-0 font-normal">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {((customer as any).tags as string[]).length > 3 && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 font-normal text-muted-foreground">
                                      +{((customer as any).tags as string[]).length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                    )}

                    {visibleColumns.includes("email") && (
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                        <a href={`mailto:${customer.email}`} className="hover:text-primary">
                          {customer.email}
                        </a>
                      </TableCell>
                    )}

                    {visibleColumns.includes("phone") && (
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                        <a href={`tel:${customer.phone}`} className="hover:text-primary">
                          {customer.phone || "—"}
                        </a>
                      </TableCell>
                    )}

                    {visibleColumns.includes("location") && (
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {[customer.city, customer.state]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </div>
                      </TableCell>
                    )}

                    {visibleColumns.includes("status") && (
                      <TableCell className="px-4 py-3">
                        <StatusBadge status={customer.status} />
                      </TableCell>
                    )}

                    {visibleColumns.includes("since") && (
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(customer.createdAt).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )}
                      </TableCell>
                    )}

                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/customers/${customer.id}`} />}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {paged.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={Object.keys(visibleColumns).length + 2}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No customers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {sorted.length > 0 && (
            <div className="border-t p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-xs text-muted-foreground">
                Showing {startIdx + 1} to {Math.min(startIdx + pageSize, sorted.length)} of{" "}
                {sorted.length}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="size-4" />
                  Prev
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, currentPage - 2) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="size-9 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Per page:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" size="sm" className="w-16">
                      {pageSize}
                    </Button>
                  } />
                  <DropdownMenuContent align="end">
                    {[10, 25, 50, 100].map((size) => (
                      <DropdownMenuItem
                        key={size}
                        onClick={() => {
                          setPageSize(size);
                          setCurrentPage(1);
                        }}
                      >
                        {size}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
