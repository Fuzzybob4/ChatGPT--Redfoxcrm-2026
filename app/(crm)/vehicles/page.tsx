import { Truck, MapPin, Navigation, Wrench, Route, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Fleet Management - RedFox CRM" };

const upcomingFeatures = [
  {
    icon: Smartphone,
    title: "Crew GPS Tracking",
    description:
      "Live location from each crew member's phone — no extra hardware required. See exactly where every team member is on the map in real time.",
  },
  {
    icon: MapPin,
    title: "Live Fleet Map",
    description:
      "All vehicles and crew pinned on a single map view. Filter by crew member, vehicle, or job status to see who is where at a glance.",
  },
  {
    icon: Truck,
    title: "Vehicle Management",
    description:
      "Assign vehicles to crew members, track make, model, year, and license plate, and see current assignment status for your entire fleet.",
  },
  {
    icon: Route,
    title: "Route History",
    description:
      "Replay any crew member's route for a given day. Useful for mileage logs, customer disputes, and scheduling future jobs more efficiently.",
  },
  {
    icon: Wrench,
    title: "Maintenance Tracking",
    description:
      "Log oil changes, inspections, and repairs per vehicle. Get reminders when mileage or date thresholds approach so nothing falls through the cracks.",
  },
  {
    icon: Navigation,
    title: "Job Dispatch",
    description:
      "Push the next job address directly to a crew member's phone from the work order screen. One tap to open navigation in their preferred maps app.",
  },
];

export default function VehiclesPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Fleet Management"
        description="Live crew GPS, vehicle tracking, and route history — built for field service teams."
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-12">

          {/* Hero block */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary">
              <Truck className="size-8" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Fleet Management
                </h2>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs font-medium">
                  Coming Soon
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                Know exactly where every crew member and vehicle is — live, from
                their phones. No GPS hardware to buy or install.
              </p>
            </div>
          </div>

          {/* Add-on pricing note */}
          <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-2">
            <p className="text-sm font-medium text-foreground">Pricing</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Fleet Management will be available as an <strong className="text-foreground">add-on to any RedFox CRM plan</strong>.
              Pricing is still being finalized — we want to make sure it reflects
              real value for small crews and larger fleets alike. You will be
              notified as soon as pricing and availability are confirmed.
            </p>
          </div>

          {/* Feature grid */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              What&apos;s included when it launches
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {upcomingFeatures.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-border p-4 space-y-2 bg-background"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary shrink-0">
                      <f.icon className="size-4" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{f.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* How GPS works note */}
          <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-2">
            <p className="text-sm font-medium text-foreground">How crew GPS works</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When a crew member taps <strong className="text-foreground">En Route</strong> on a work order, their phone
              begins sharing location with the dispatcher. Tracking stops
              automatically when they tap <strong className="text-foreground">Complete Job</strong> — no background
              tracking outside of active job hours. Privacy controls and
              opt-in consent will be built into the crew mobile experience.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
