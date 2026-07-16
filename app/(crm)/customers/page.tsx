"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CustomersDataTable } from "@/components/customers/customers-data-table";

import { useData } from "@/lib/data-context";
import { useLocation } from "@/lib/location-context";
import { CSVImportDialog } from "@/components/customers/csv-import-dialog";

export default function CustomersPage() {
  const { loading, refresh, getLocationCustomers } = useData();
  const { selectedLocationId } = useLocation();
  const customers = getLocationCustomers(selectedLocationId);

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
        title="Customers"
        description={`${customers.length} accounts`}
        actions={
          <div className="flex items-center gap-2">
            <CSVImportDialog />
            <Button size="sm" render={<Link href="/customers/new" />}>
              <Plus className="size-3.5" data-icon="inline-start" />
              Add Customer
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <CustomersDataTable customers={customers} onRefresh={refresh} />
      </div>
    </div>
  );
}
