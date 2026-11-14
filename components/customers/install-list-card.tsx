"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InstallItems } from "@/components/field/install-items";
import type { InstallItem } from "@/lib/field";
import { getCustomerInstallList } from "@/app/(crm)/customers/install-list-actions";

export function InstallListCard({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<InstallItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    getCustomerInstallList(customerId)
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [customerId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-primary" />
          Install list &amp; materials
        </CardTitle>
        <CardDescription className="text-xs">
          From this season&apos;s estimate or invoice. The crew sees this same list on the job, without prices.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {items === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <InstallItems
            bare
            items={items}
            emptyText="No items yet. Once this season's estimate or invoice has line items, they show up here."
          />
        )}
      </CardContent>
    </Card>
  );
}
