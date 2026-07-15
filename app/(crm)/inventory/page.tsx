import {
  Package,
  ScanBarcode,
  Boxes,
  ClipboardList,
  TrendingDown,
  Truck,
  Bell,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

const FEATURES = [
  {
    icon: Boxes,
    title: "Stock Tracking",
    description: "Track every strand of lights, clips, controllers, and hardware across all your storage locations.",
  },
  {
    icon: ScanBarcode,
    title: "Barcode & QR Scanning",
    description: "Scan items in and out using your phone camera. No extra hardware required.",
  },
  {
    icon: ClipboardList,
    title: "Job-Level Allocation",
    description: "Assign inventory directly to work orders so your crew knows exactly what to load.",
  },
  {
    icon: TrendingDown,
    title: "Low-Stock Alerts",
    description: "Get notified before you run out of your most-used items mid-season.",
  },
  {
    icon: Truck,
    title: "Supplier Orders",
    description: "Create and track purchase orders to your lighting suppliers from inside the CRM.",
  },
  {
    icon: Bell,
    title: "End-of-Season Audit",
    description: "Run a full inventory count after removal season to reconcile losses and plan next year.",
  },
];

export default function InventoryPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Inventory Management"
        description="Track your lights, hardware, and supplies across jobs and storage locations."
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">

          {/* Hero */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full">
              Coming Soon
            </div>
            <div className="flex justify-center">
              <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Package className="size-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-balance">
              Full Inventory Control,<br />Built for Lighting Pros
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
              Stop losing track of strands, clips, and controllers. RedFox Inventory Management will give you a real-time view of every item — from the warehouse to the job site and back.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-border/60">
                <CardContent className="pt-5 pb-5 px-5 flex gap-4">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pricing note */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">Included with all plans</p>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                  No extra charge
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Inventory management will be included in your existing Starter, Professional, or Enterprise plan — no additional cost.
              </p>
            </div>
            <Link href="/landing/pricing" className="shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                View Plans <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>

          {/* Support link */}
          <p className="text-center text-xs text-muted-foreground">
            Questions or early-access requests?{" "}
            <Link href="/landing/support" className="text-primary font-medium hover:underline">
              Contact our team
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
