import { Mail, Send, BarChart2, Users, ShieldCheck, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Email Marketing - RedFox CRM" };

const upcomingFeatures = [
  {
    icon: Send,
    title: "Branded Campaigns",
    description:
      "Send from your own business email — hello@yourbusiness.com — with full domain verification through Resend's platform.",
  },
  {
    icon: Users,
    title: "Smart Audience Segments",
    description:
      "Target by job status: re-book installed customers, remind removals, or send promos to estimate leads — all from a single list.",
  },
  {
    icon: BarChart2,
    title: "Delivery Analytics",
    description:
      "Track open rates, click-through, bounces, and unsubscribes per campaign with a live dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Built In",
    description:
      "One-click unsubscribe, CAN-SPAM footer, and opt-in consent tracking are handled automatically on every send.",
  },
  {
    icon: Zap,
    title: "Pre-Built Templates",
    description:
      "Ready-to-send templates for seasonal installs, removal reminders, year-end re-booking, and invoice follow-ups.",
  },
  {
    icon: BarChart2,
    title: "Plan-Based Send Limits",
    description:
      "2,000 sends/mo on Basic, 4,000 on Pro, 8,000+ on Enterprise with pay-per-1,000 overage pricing.",
  },
];

export default function EmailMarketingPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Email Marketing"
        description="Branded campaigns, smart segmentation, and compliance — built for service businesses."
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-12">

          {/* Hero block */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary">
              <Mail className="size-8" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Email Marketing
                </h2>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs font-medium">
                  Coming Soon
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                We&apos;re partnering with Resend&apos;s Platform API so every RedFox CRM
                business sends from their own branded domain — no shared
                reputation, no deliverability headaches.
              </p>
            </div>
          </div>

          {/* Why it's not live yet */}
          <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-2">
            <p className="text-sm font-medium text-foreground">Why is this in review?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Rather than routing all customer emails through a single RedFox
              API key — which would mix sending reputations and violate Resend&apos;s
              terms — we applied for Resend&apos;s <strong className="text-foreground">Platforms program</strong>. Once
              approved, each business on RedFox CRM gets an isolated sending
              identity with their own domain. We&apos;re waiting on approval and will
              activate the feature the moment it clears.
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

          {/* Plan table */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Included sends per month
            </p>
            <div className="rounded-xl border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Plan</span>
                <span className="text-center">Monthly sends</span>
                <span className="text-right">Overage</span>
              </div>
              {[
                { plan: "Basic", sends: "2,000", overage: "None" },
                { plan: "Pro", sends: "4,000", overage: "None" },
                { plan: "Enterprise", sends: "8,000", overage: "$1 per 1,000" },
              ].map((row, i) => (
                <div
                  key={row.plan}
                  className={`grid grid-cols-3 px-4 py-3 ${i !== 2 ? "border-b border-border" : ""}`}
                >
                  <span className="font-medium text-foreground">{row.plan}</span>
                  <span className="text-center text-muted-foreground">{row.sends}</span>
                  <span className="text-right text-muted-foreground">{row.overage}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
