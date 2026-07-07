"use client";

import { useState, useRef } from "react";
import {
  Building,
  Zap,
  CreditCard,
  Mail,
  Bell,
  BookOpen,
  Upload,
  Globe,
  Trash2,
  Check,
  Lock,
  Package,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const ADD_ONS = [
  { id: "recurring_services", name: "Recurring Services", price: "$29/mo", description: "Manage recurring service contracts and billing cycles" },
  { id: "route_optimization", name: "Route Optimization", price: "$49/mo", description: "Optimize routes for your crews to save time and fuel" },
  { id: "portal_upsells", name: "Customer Portal Upsells", price: "$19/mo", description: "Allow customers to add optional services when paying invoices" },
  { id: "sms_notifications", name: "SMS Notifications", price: "$29/mo", description: "Send text messages to customers about jobs and appointments" },
  { id: "email_campaigns", name: "Email Campaigns", price: "$19/mo", description: "Send marketing emails and newsletters to customers" },
];

const INTEGRATIONS = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept online payments from customers",
    icon: CreditCard,
    connected: true,
    badge: "Payments",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Sync invoices and expenses with QuickBooks Online",
    icon: BookOpen,
    connected: false,
    badge: "Accounting",
  },
  {
    id: "resend",
    name: "Resend",
    description: "Transactional email for invoices and job updates",
    icon: Mail,
    connected: false,
    badge: "Email",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Billable SMS notifications — $0.01/text after 100 free/mo",
    icon: Bell,
    connected: false,
    badge: "SMS",
    note: "Billed per message",
  },
];

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeAddons, setActiveAddons] = useState<Set<string>>(new Set(["route_optimization"]));
  const [saved, setSaved] = useState(false);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoUrl(url);
  }

  function toggleAddon(id: string) {
    setActiveAddons((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Settings"
        description="Manage your account, integrations, and preferences"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="business" className="space-y-6">
            <TabsList className="h-9">
              <TabsTrigger value="business" className="text-xs px-3">Business</TabsTrigger>
              <TabsTrigger value="integrations" className="text-xs px-3">Integrations</TabsTrigger>
              <TabsTrigger value="addons" className="text-xs px-3">Add-Ons</TabsTrigger>
              <TabsTrigger value="danger" className="text-xs px-3">Advanced</TabsTrigger>
            </TabsList>

            {/* ── Business Info ─────────────────────────────────── */}
            <TabsContent value="business" className="space-y-5">
              {/* Logo upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ImageIcon className="size-4 text-primary" />
                    Business Logo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Appears on estimates, invoices, and the customer portal.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div
                      className="size-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="Business logo" className="w-full h-full object-contain" />
                      ) : (
                        <Upload className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-3.5 mr-1.5" />
                        Upload Logo
                      </Button>
                      {logoUrl && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setLogoUrl(null)}>
                          <Trash2 className="size-3.5 mr-1.5" />
                          Remove
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">PNG or JPG, max 2 MB</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Business details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building className="size-4 text-primary" />
                    Business Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-name" className="text-xs font-medium">Business Name</Label>
                      <Input id="biz-name" defaultValue="RedFox Services LLC" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-phone" className="text-xs font-medium">Phone</Label>
                      <Input id="biz-phone" defaultValue="(512) 555-0000" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-email" className="text-xs font-medium">Business Email</Label>
                    <Input id="biz-email" defaultValue="hello@redfoxservices.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-website" className="text-xs font-medium flex items-center gap-1.5">
                      <Globe className="size-3.5" />
                      Website
                    </Label>
                    <Input id="biz-website" placeholder="https://yourcompany.com" defaultValue="https://redfoxservices.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-address" className="text-xs font-medium">Address</Label>
                    <Input id="biz-address" defaultValue="123 Main St, Austin TX 78701" />
                  </div>
                  <Button size="sm" onClick={handleSave} className="gap-1.5">
                    {saved ? <><Check className="size-3.5" /> Saved</> : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>

              {/* Invoice & Estimate defaults */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Package className="size-4 text-primary" />
                    Estimate & Invoice Defaults
                  </CardTitle>
                  <CardDescription className="text-xs">
                    These fields appear on every new estimate and invoice. Can be overridden per document.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="doc-title" className="text-xs font-medium">Default Title</Label>
                      <Input id="doc-title" defaultValue="Holiday Lighting Services" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-to" className="text-xs font-medium">Pay to the Order of</Label>
                      <Input id="pay-to" defaultValue="RedFox Services LLC" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="service-agreement" className="text-xs font-medium">Service Agreement</Label>
                    <textarea
                      id="service-agreement"
                      rows={4}
                      defaultValue="By accepting this estimate, you agree to the terms of service. Payment is due within 14 days of invoice. Cancellations must be made 48 hours in advance."
                      className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="doc-notes" className="text-xs font-medium">Default Notes</Label>
                    <textarea
                      id="doc-notes"
                      rows={3}
                      placeholder="Thank you for your business! Please contact us with any questions."
                      className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <Button size="sm" onClick={handleSave} className="gap-1.5">
                    {saved ? <><Check className="size-3.5" /> Saved</> : "Save Defaults"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Integrations ──────────────────────────────────── */}
            <TabsContent value="integrations">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="size-4 text-primary" />
                    Integrations
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Connect your payments, accounting, email, and messaging providers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border space-y-0 p-0 px-6 pb-6">
                  {INTEGRATIONS.map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between gap-4 py-4 first:pt-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-muted border border-border">
                          <integration.icon className="size-4 text-primary" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{integration.name}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 h-4">{integration.badge}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{integration.description}</p>
                          {integration.note && (
                            <p className="text-[10px] text-amber-600 mt-0.5">{integration.note}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {integration.connected ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs gap-1">
                            <Check className="size-3" />
                            Connected
                          </Badge>
                        ) : (
                          <Button variant="outline" size="sm" className="text-xs">
                            Connect
                            <ChevronRight className="size-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Add-Ons ───────────────────────────────────────── */}
            <TabsContent value="addons">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Package className="size-4 text-primary" />
                    Add-On Services
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Toggle services on or off. Active add-ons are billed monthly alongside your plan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border space-y-0 p-0 px-6 pb-6">
                  {ADD_ONS.map((addon) => {
                    const active = activeAddons.has(addon.id);
                    return (
                      <div key={addon.id} className="flex items-center justify-between gap-4 py-4 first:pt-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{addon.name}</p>
                            <span className="text-xs font-semibold text-primary">{addon.price}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{addon.description}</p>
                        </div>
                        <Switch
                          checked={active}
                          onCheckedChange={() => toggleAddon(addon.id)}
                          aria-label={`Toggle ${addon.name}`}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              {activeAddons.size > 0 && (
                <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Active Add-Ons</p>
                    <p className="text-xs text-muted-foreground">
                      {ADD_ONS.filter((a) => activeAddons.has(a.id)).map((a) => a.name).join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-primary">
                      ${ADD_ONS.filter((a) => activeAddons.has(a.id))
                        .reduce((s, a) => s + parseInt(a.price.replace(/\D/g, "")), 0)}/mo
                    </p>
                    <p className="text-xs text-muted-foreground">billed monthly</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Advanced / Danger ─────────────────────────────── */}
            <TabsContent value="danger" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Lock className="size-4 text-primary" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Change Password</p>
                      <p className="text-xs text-muted-foreground">Update your account password</p>
                    </div>
                    <Button variant="outline" size="sm">Change</Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Two-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground">Add a second layer of security</p>
                    </div>
                    <Button variant="outline" size="sm">Enable</Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Delete Account</p>
                      <p className="text-xs text-muted-foreground">Permanently delete your CRM account and all data</p>
                    </div>
                    <Button variant="destructive" size="sm">Delete Account</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
