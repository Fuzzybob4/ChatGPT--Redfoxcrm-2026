"use client";

import { useState } from "react";
import { AddonPaymentModal } from "@/components/settings/addon-payment-modal";
import {
  Building,
  Zap,
  CreditCard,
  Mail,
  Bell,
  BookOpen,
  Upload,
  Globe,
  Check,
  Lock,
  Package,
} from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ADDONS, formatCents, getAddonsMonthlyCents } from "@/lib/pricing";
import { saveBusinessProfile } from "@/app/(crm)/settings/actions";

// Display shape derived from the shared pricing source of truth.
const ADD_ONS = ADDONS.map((a) => ({
  id: a.id,
  name: a.name,
  price: a.monthlyCents != null ? `${formatCents(a.monthlyCents)}/mo` : 'Coming soon',
  description: a.description,
}));

const INTEGRATIONS = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept online payments from customers",
    icon: CreditCard,
    badge: "Payments",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Sync invoices and expenses with QuickBooks Online",
    icon: BookOpen,
    badge: "Accounting",
    availability: "Coming soon",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Import contacts, companies, and deal history",
    icon: Upload,
    badge: "CRM Import",
    availability: "Coming soon",
  },
  {
    id: "jobber",
    name: "Jobber",
    description: "Import clients, properties, quotes, jobs, and invoices",
    icon: Upload,
    badge: "CRM Import",
    availability: "Coming soon",
  },
  {
    id: "square",
    name: "Square",
    description: "Import customers, invoices, and payment history",
    icon: Upload,
    badge: "Data Import",
    availability: "Coming soon",
  },
  {
    id: "resend",
    name: "Resend",
    description: "Transactional email for invoices and job updates",
    icon: Mail,
    badge: "Email",
    availability: "Managed by RedFox",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Billable SMS notifications — $0.01/text after 100 free/mo",
    icon: Bell,
    badge: "SMS",
    note: "Billed per message",
    availability: "Coming soon",
  },
];

interface BusinessProfile {
  business_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

interface OrganizationSettings {
  active_addons?: string[] | null;
  stripe_account_id?: string | null;
  stripe_charges_enabled?: boolean | null;
  card_brand?: string | null;
  card_last4?: string | null;
}

export interface SettingsContentProps {
  businessProfile: BusinessProfile | null;
  orgData: OrganizationSettings | null;
}

export function SettingsContent({
  businessProfile,
  orgData,
}: SettingsContentProps) {
  // Add-ons already paid for and active on the account.
  const [persistedAddons, setPersistedAddons] = useState<Set<string>>(
    new Set<string>(orgData?.active_addons ?? []),
  );
  // Currently toggled-on add-ons (includes persisted + any newly selected).
  const [activeAddons, setActiveAddons] = useState<Set<string>>(
    new Set<string>(orgData?.active_addons ?? []),
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessForm, setBusinessForm] = useState({
    businessName: businessProfile?.business_name || "",
    phone: businessProfile?.phone || "",
    email: businessProfile?.email || "",
    website: businessProfile?.website || "",
    address: businessProfile?.address || "",
    city: businessProfile?.city || "",
    state: businessProfile?.state || "",
    zipCode: businessProfile?.zip_code || "",
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingAddons, setPendingAddons] = useState<string[]>([]);

  // Build integration status based on orgData
  const integrationsWithStatus = INTEGRATIONS.map((integration) => ({
    ...integration,
    connected:
      integration.id === "stripe" && orgData?.stripe_account_id && orgData?.stripe_charges_enabled,
  }));

  // Only add-ons toggled on that haven't been paid for yet.
  const newlySelected = Array.from(activeAddons).filter((id) => !persistedAddons.has(id));
  const newChargeCents = getAddonsMonthlyCents(newlySelected);

  function toggleAddon(id: string) {
    // Prevent un-toggling something already paid for from this quick view.
    setActiveAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSaveAddons() {
    if (newlySelected.length > 0) {
      setPendingAddons(newlySelected);
      setShowPaymentModal(true);
    }
  }

  function handlePaymentSuccess(addons: string[]) {
    // Mark the returned active add-ons as persisted so the paywall clears.
    setPersistedAddons(new Set<string>(addons));
    setActiveAddons(new Set<string>(addons));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveBusiness() {
    setSavingBusiness(true);
    setSaveError(null);
    const result = await saveBusinessProfile(businessForm);
    setSavingBusiness(false);
    if (!result.success) {
      setSaveError(result.error || "Could not save business information");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-4 md:p-6">
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
                    <Input
                      id="biz-name"
                      value={businessForm.businessName}
                      onChange={(event) => setBusinessForm((current) => ({ ...current, businessName: event.target.value }))}
                      placeholder="Your business name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-phone" className="text-xs font-medium">Phone</Label>
                    <Input
                      id="biz-phone"
                      value={businessForm.phone}
                      onChange={(event) => setBusinessForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-email" className="text-xs font-medium">Business Email</Label>
                  <Input
                    id="biz-email"
                    value={businessForm.email}
                    onChange={(event) => setBusinessForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="hello@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-website" className="text-xs font-medium flex items-center gap-1.5">
                    <Globe className="size-3.5" />
                    Website
                  </Label>
                  <Input
                    id="biz-website"
                    placeholder="https://yourcompany.com"
                    value={businessForm.website}
                    onChange={(event) => setBusinessForm((current) => ({ ...current, website: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-address" className="text-xs font-medium">Address</Label>
                  <Input
                    id="biz-address"
                    value={businessForm.address}
                    onChange={(event) => setBusinessForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder="123 Main St, City, State 12345"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-city" className="text-xs font-medium">City</Label>
                    <Input id="biz-city" value={businessForm.city} onChange={(event) => setBusinessForm((current) => ({ ...current, city: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-state" className="text-xs font-medium">State</Label>
                    <Input id="biz-state" value={businessForm.state} onChange={(event) => setBusinessForm((current) => ({ ...current, state: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-zip" className="text-xs font-medium">ZIP</Label>
                    <Input id="biz-zip" value={businessForm.zipCode} onChange={(event) => setBusinessForm((current) => ({ ...current, zipCode: event.target.value }))} />
                  </div>
                </div>
                {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                <Button size="sm" onClick={handleSaveBusiness} disabled={savingBusiness} className="gap-1.5">
                  {saved ? <><Check className="size-3.5" /> Saved</> : savingBusiness ? "Saving..." : "Save Changes"}
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
                    <Input id="doc-title" placeholder="e.g., Professional Services" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pay-to" className="text-xs font-medium">Pay to the Order of</Label>
                    <Input
                      id="pay-to"
                      placeholder="Business name"
                      defaultValue={businessProfile?.business_name || ""}
                    />
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
                <p className="text-xs text-muted-foreground">Document defaults are not enabled for the pilot. Titles, agreements, and notes can still be set on each estimate or invoice.</p>
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
                {integrationsWithStatus.map((integration) => (
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
                      ) : <Badge variant="secondary" className="text-xs">{integration.availability || "Coming soon"}</Badge>}
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
                  const isPaid = persistedAddons.has(addon.id);
                  return (
                    <div key={addon.id} className="flex items-center justify-between gap-4 py-4 first:pt-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{addon.name}</p>
                          <span className="text-xs font-semibold text-primary">{addon.price}</span>
                          {isPaid && (
                            <Badge variant="outline" className="text-[10px] px-1.5 h-4 text-emerald-700 border-emerald-200 bg-emerald-50 gap-1">
                              <Check className="size-2.5" />
                              Active
                            </Badge>
                          )}
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
            {newlySelected.length > 0 && (
              <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">New Add-Ons to Activate</p>
                    <p className="text-xs text-muted-foreground">
                      {ADD_ONS.filter((a) => newlySelected.includes(a.id)).map((a) => a.name).join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-primary">
                      {formatCents(newChargeCents)}/mo
                    </p>
                    <p className="text-xs text-muted-foreground">billed monthly</p>
                  </div>
                </div>
                <Button
                  onClick={handleSaveAddons}
                  className="w-full gap-1.5"
                >
                  <CreditCard className="size-3.5" />
                  Pay Now to Activate
                </Button>
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

        {/* Payment Modal */}
        <AddonPaymentModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          selectedAddons={pendingAddons}
          onSuccess={handlePaymentSuccess}
          cardBrand={orgData?.card_brand}
          cardLast4={orgData?.card_last4}
        />
      </div>
    </div>
  );
}
