"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Send, Mail, Users, Eye, MousePointerClick,
  Clock, CheckCircle2, Pencil, Trash2, Copy, Settings,
  Megaphone, FileText, AlertCircle, BarChart3, Loader2,
  CalendarClock, ChevronRight, Info,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  saveCampaign, deleteCampaign, sendCampaign, saveEmailSettings,
  type CampaignInput,
} from "./actions";

// ── Types ────────────────────────────────────────────────────────────────────
type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

interface DbCampaign {
  id: string;
  name: string;
  subject: string;
  preview_text: string;
  campaign_type: string;
  status: CampaignStatus;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  html_body: string | null;
  text_body: string | null;
  segment_filter: Record<string, any>;
  recipient_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  unsubscribed_count: number;
  created_at: string;
}

interface OrgEmailSettings {
  from_name: string;
  from_email: string;
  reply_to: string | null;
  physical_address: string | null;
  resend_domain_status: string;
}

interface Props {
  campaigns: DbCampaign[];
  optInStats: { total: number; optedIn: number };
  settings: OrgEmailSettings | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<CampaignStatus, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-gray-100 text-gray-600 border-gray-200" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700 border-blue-200" },
  sending:   { label: "Sending",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  sent:      { label: "Sent",      className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-600 border-red-200" },
};

const CAMPAIGN_TYPES = [
  { value: "seasonal_promo",    label: "Seasonal Promotion" },
  { value: "removal_reminder",  label: "Removal Reminder" },
  { value: "rebook",            label: "New Year Re-booking" },
  { value: "invoice_followup",  label: "Invoice Follow-up" },
  { value: "general",           label: "General Newsletter" },
];

const TEMPLATES: { type: string; name: string; subject: string; body: string }[] = [
  {
    type: "seasonal_promo",
    name: "Holiday Season Kickoff",
    subject: "Your lights are ready — book your installation today!",
    body: `Hi there,

The holiday season is just around the corner and our calendar is filling up fast.

Whether you're looking to add new displays this year or bring back last year's magic, our team is ready to make it happen.

Book your installation before [DATE] and save 15% on labor.

Click below to schedule your appointment or reply to this email and we'll reach out to set something up.

Looking forward to lighting up your home!

[Your Company Name]`,
  },
  {
    type: "removal_reminder",
    name: "January Removal Reminder",
    subject: "Schedule your light removal — January slots filling fast",
    body: `Hi there,

The holidays are winding down and it's time to schedule your light removal.

We want to make the process as easy as possible. Reply to this email or give us a call to lock in your preferred removal date.

January books up quickly — we recommend scheduling before the end of this week.

Thank you for another great season!

[Your Company Name]`,
  },
  {
    type: "rebook",
    name: "Early 2026 Re-booking",
    subject: "Reserve your 2026 install date now — limited availability",
    body: `Hi there,

We had a wonderful time lighting up your home last season and we would love to do it again in 2026.

To guarantee your preferred install window, we encourage you to book early. Our most popular dates in November sell out months in advance.

Reply to this email to lock in your spot or simply click below to schedule.

We look forward to another bright season with you!

[Your Company Name]`,
  },
  {
    type: "invoice_followup",
    name: "Invoice Follow-up",
    subject: "Friendly reminder: your invoice is due soon",
    body: `Hi there,

This is a friendly reminder that you have an outstanding invoice with us.

If you have any questions about your invoice or would like to discuss payment options, please don't hesitate to reach out. We're happy to help.

Thank you for your business — we appreciate you!

[Your Company Name]`,
  },
  {
    type: "general",
    name: "General Newsletter",
    subject: "A note from [Your Company Name]",
    body: `Hi there,

We hope this message finds you well!

[Write your message here.]

As always, thank you for being a valued customer. We look forward to serving you.

Warmly,
[Your Company Name]`,
  },
];

// ── Empty form state ──────────────────────────────────────────────────────────
function emptyForm(settings: OrgEmailSettings | null): CampaignInput {
  return {
    name: "",
    subject: "",
    previewText: "",
    campaignType: "general",
    fromName: settings?.from_name ?? "",
    fromEmail: settings?.from_email ?? "",
    replyTo: settings?.reply_to ?? "",
    htmlBody: "",
    textBody: "",
    segmentFilter: {},
    scheduledAt: "",
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export function EmailMarketingClient({ campaigns: initial, optInStats, settings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [campaigns, setCampaigns] = useState(initial);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignInput>(() => emptyForm(settings));
  const [deleteTarget, setDeleteTarget] = useState<DbCampaign | null>(null);
  const [sendTarget, setSendTarget] = useState<DbCampaign | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; skipped: number } | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("campaigns");

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    fromName: settings?.from_name ?? "",
    fromEmail: settings?.from_email ?? "",
    replyTo: settings?.reply_to ?? "",
    physicalAddress: settings?.physical_address ?? "",
  });
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);

  // ── Composer helpers ──────────────────────────────────────────────────────
  function openNew() {
    setEditingId(null);
    setForm(emptyForm(settings));
    setError("");
    setComposerOpen(true);
  }

  function openEdit(c: DbCampaign) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      subject: c.subject,
      previewText: c.preview_text,
      campaignType: c.campaign_type,
      fromName: c.from_name,
      fromEmail: c.from_email,
      replyTo: c.reply_to ?? "",
      htmlBody: c.html_body ?? "",
      textBody: c.text_body ?? "",
      segmentFilter: c.segment_filter ?? {},
      scheduledAt: c.scheduled_at ?? "",
    });
    setError("");
    setComposerOpen(true);
  }

  function applyTemplate(tpl: (typeof TEMPLATES)[number]) {
    setForm((f) => ({
      ...f,
      name: tpl.name,
      campaignType: tpl.type,
      subject: tpl.subject,
      textBody: tpl.body,
    }));
    setTab("campaigns");
    setComposerOpen(true);
  }

  function handleSave(status?: string) {
    if (!form.name.trim()) { setError("Campaign name is required."); return; }
    if (!form.subject.trim()) { setError("Subject line is required."); return; }
    if (!form.fromEmail.trim()) { setError("Sending email address is required. Add one in Settings."); return; }
    setError("");
    startTransition(async () => {
      try {
        await saveCampaign(editingId, form);
        setComposerOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save campaign.");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteCampaign(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    });
  }

  function handleSend() {
    if (!sendTarget) return;
    startTransition(async () => {
      try {
        const result = await sendCampaign(sendTarget.id);
        setSendResult(result);
        setSendTarget(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send campaign.");
        setSendTarget(null);
      }
    });
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError("");
    if (!settingsForm.fromEmail.trim()) { setSettingsError("Sending email is required."); return; }
    if (!settingsForm.physicalAddress.trim()) { setSettingsError("Physical address is required by CAN-SPAM law."); return; }
    startTransition(async () => {
      try {
        await saveEmailSettings(settingsForm);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      } catch (e) {
        setSettingsError(e instanceof Error ? e.message : "Failed to save settings.");
      }
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const sentCampaigns = campaigns.filter((c) => c.status === "sent");
  const totalSent = sentCampaigns.reduce((s, c) => s + (c.recipient_count ?? 0), 0);
  const avgOpen = sentCampaigns.length
    ? (sentCampaigns.reduce((s, c) => s + (c.recipient_count ? (c.opened_count / c.recipient_count) * 100 : 0), 0) / sentCampaigns.length).toFixed(1)
    : "—";
  const avgClick = sentCampaigns.length
    ? (sentCampaigns.reduce((s, c) => s + (c.recipient_count ? (c.clicked_count / c.recipient_count) * 100 : 0), 0) / sentCampaigns.length).toFixed(1)
    : "—";

  const needsSetup = !settings?.from_email || !settings?.physical_address;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">

      {/* Setup banner */}
      {needsSetup && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Finish setting up email sending</p>
            <p className="text-amber-700 mt-0.5">
              Add your sending email address and physical mailing address before you can send campaigns.{" "}
              <button className="underline font-medium" onClick={() => setTab("settings")}>Go to Settings</button>
            </p>
          </div>
        </div>
      )}

      {/* Send result banner */}
      {sendResult && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Campaign sent successfully</p>
            <p className="text-emerald-700 mt-0.5">
              {sendResult.sent.toLocaleString()} emails delivered.
              {sendResult.skipped > 0 && ` ${sendResult.skipped.toLocaleString()} skipped due to monthly quota.`}
            </p>
          </div>
          <button className="ml-auto" onClick={() => setSendResult(null)} aria-label="Dismiss">
            <span className="text-emerald-500 hover:text-emerald-700 text-lg leading-none">&times;</span>
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p>{error}</p>
          <button className="ml-auto text-destructive/60 hover:text-destructive" onClick={() => setError("")}>&times;</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Opted-in Contacts", value: optInStats.optedIn.toLocaleString(), sub: `of ${optInStats.total.toLocaleString()} total`, icon: Users },
          { label: "Emails Sent", value: totalSent.toLocaleString(), sub: "all time", icon: Mail },
          { label: "Avg Open Rate", value: avgOpen === "—" ? "—" : `${avgOpen}%`, sub: "across campaigns", icon: Eye },
          { label: "Avg Click Rate", value: avgClick === "—" ? "—" : `${avgClick}%`, sub: "across campaigns", icon: MousePointerClick },
        ].map(({ label, value, sub, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Icon className="size-4 text-primary" />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground/70">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="h-9">
            <TabsTrigger value="campaigns" className="text-xs px-3 gap-1.5">
              <Megaphone className="size-3.5" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs px-3 gap-1.5">
              <FileText className="size-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs px-3 gap-1.5">
              <Users className="size-3.5" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs px-3 gap-1.5">
              <Settings className="size-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          {tab === "campaigns" && (
            <Button size="sm" onClick={openNew}>
              <Plus className="size-3.5 mr-1.5" />
              New Campaign
            </Button>
          )}
        </div>

        {/* ── Campaigns ──────────────────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="mt-4 space-y-3">
          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <Megaphone className="size-6 text-primary" />
                </span>
                <p className="font-medium">No campaigns yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Create your first campaign or start from one of the ready-made templates.
                </p>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" onClick={openNew}>
                    <Plus className="size-3.5 mr-1.5" />New Campaign
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTab("templates")}>
                    Browse Templates
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            campaigns.map((c) => {
              const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.draft;
              const openPct = c.recipient_count
                ? ((c.opened_count / c.recipient_count) * 100).toFixed(1)
                : null;
              const clickPct = c.recipient_count
                ? ((c.clicked_count / c.recipient_count) * 100).toFixed(1)
                : null;

              return (
                <Card key={c.id} className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-medium text-sm">{c.name}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${st.className}`}>
                            {c.status === "scheduled" && <Clock className="size-2.5 mr-1 inline" />}
                            {c.status === "sent" && <CheckCircle2 className="size-2.5 mr-1 inline" />}
                            {c.status === "sending" && <Loader2 className="size-2.5 mr-1 inline animate-spin" />}
                            {st.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {(c.status === "draft" || c.status === "scheduled") && (
                          <Button
                            variant="outline" size="sm"
                            className="text-xs h-7 px-2.5"
                            onClick={() => setSendTarget(c)}
                            disabled={isPending || needsSetup}
                          >
                            <Send className="size-3 mr-1" />Send
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      {c.status === "sent" && c.sent_at && (
                        <span className="flex items-center gap-1">
                          <Send className="size-3" />
                          {c.recipient_count.toLocaleString()} sent &middot;{" "}
                          {new Date(c.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                      {c.status === "scheduled" && c.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="size-3" />
                          Scheduled for {new Date(c.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {openPct !== null && (
                        <span className="flex items-center gap-1">
                          <Eye className="size-3" />{openPct}% open
                        </span>
                      )}
                      {clickPct !== null && (
                        <span className="flex items-center gap-1">
                          <MousePointerClick className="size-3" />{clickPct}% click
                        </span>
                      )}
                      {c.bounced_count > 0 && (
                        <span className="flex items-center gap-1 text-destructive/70">
                          <AlertCircle className="size-3" />{c.bounced_count} bounced
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Templates ──────────────────────────────────────────────────────── */}
        <TabsContent value="templates" className="mt-4 space-y-3">
          {TEMPLATES.map((tpl) => (
            <Card key={tpl.type} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{tpl.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {CAMPAIGN_TYPES.find((ct) => ct.value === tpl.type)?.label ?? tpl.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{tpl.subject}</p>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    className="shrink-0 text-xs h-8"
                    onClick={() => applyTemplate(tpl)}
                  >
                    Use Template <ChevronRight className="size-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Contacts ───────────────────────────────────────────────────────── */}
        <TabsContent value="contacts" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Marketing Contacts</CardTitle>
              <CardDescription>
                Only customers who have opted in to marketing emails will receive campaigns. Manage consent from each customer&apos;s profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Opted-in Contacts", value: optInStats.optedIn, color: "text-emerald-600" },
                  { label: "Total Customers", value: optInStats.total, color: "text-foreground" },
                  { label: "Not Yet Opted In", value: optInStats.total - optInStats.optedIn, color: "text-muted-foreground" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border bg-muted/30 p-4">
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-800">
                <Info className="size-4 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1.5">
                  <p className="font-medium">How to add contacts</p>
                  <p className="text-blue-700">
                    Open a customer record and check "Marketing emails" under their contact info. Only customers who have explicitly opted in will be included in campaigns — this keeps you compliant with CAN-SPAM and GDPR.
                  </p>
                  <a href="/customers" className="inline-flex items-center gap-1 font-medium underline">
                    Go to Customers <ChevronRight className="size-3" />
                  </a>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">Compliance notes</p>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Every email includes a one-click unsubscribe link (CAN-SPAM / RFC 8058)</li>
                  <li>Your physical mailing address is included in every email footer</li>
                  <li>Bounced and complained addresses are automatically suppressed</li>
                  <li>Unsubscribes are honored immediately — the contact&apos;s opt-in is cleared in your CRM</li>
                  <li>Never import addresses without explicit consent</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings ───────────────────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sending Configuration</CardTitle>
              <CardDescription>
                Set the default from address and physical mailing address. Every business on RedFox CRM sends from their own email domain.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="set-from-name">From Name</Label>
                    <Input
                      id="set-from-name"
                      value={settingsForm.fromName}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, fromName: e.target.value }))}
                      placeholder="Lone Star Lighting Displays"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="set-from-email">Sending Email Address *</Label>
                    <Input
                      id="set-from-email"
                      type="email"
                      value={settingsForm.fromEmail}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, fromEmail: e.target.value }))}
                      placeholder="hello@lonestar.com"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Must be a verified domain in Resend. See the Domain Verification section below.
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="set-reply-to">Reply-to Address (optional)</Label>
                  <Input
                    id="set-reply-to"
                    type="email"
                    value={settingsForm.replyTo}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, replyTo: e.target.value }))}
                    placeholder="support@lonestar.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="set-address">Physical Mailing Address *</Label>
                  <Textarea
                    id="set-address"
                    value={settingsForm.physicalAddress}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, physicalAddress: e.target.value }))}
                    placeholder={"123 Main St, Suite 100\nAustin, TX 78701"}
                    rows={2}
                    className="resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required by CAN-SPAM law. Appears in the footer of every email.
                  </p>
                </div>

                {settingsError && <p className="text-sm text-destructive">{settingsError}</p>}
                {settingsSaved && <p className="text-sm text-emerald-600">Settings saved.</p>}

                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Saving...</> : "Save Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Domain Verification</CardTitle>
              <CardDescription>
                To send from your own domain (e.g. hello@yourcompany.com), you need to verify it with Resend by adding DNS records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`size-2 rounded-full ${settings?.resend_domain_status === "verified" ? "bg-emerald-500" : "bg-amber-400"}`} />
                <span className="text-sm capitalize">{settings?.resend_domain_status ?? "Not configured"}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Log in to your{" "}
                <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline text-foreground">
                  Resend dashboard
                </a>
                , add your domain, copy the SPF and DKIM DNS records, and add them in your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.). Verification usually takes a few minutes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plan &amp; Quota</CardTitle>
              <CardDescription>Monthly email send limits per plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y text-sm">
                {[
                  { plan: "Basic", limit: "2,000 emails / month", note: "No overage — upgrades required" },
                  { plan: "Pro", limit: "4,000 emails / month", note: "No overage — upgrades required" },
                  { plan: "Enterprise", limit: "8,000 emails / month base", note: "Pay-per-use above 8,000 ($X per 1,000)" },
                ].map(({ plan, limit, note }) => (
                  <div key={plan} className="flex items-start justify-between py-3 gap-3">
                    <div>
                      <p className="font-medium">{plan}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
                    </div>
                    <p className="text-muted-foreground text-right shrink-0">{limit}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Campaign Composer Dialog ────────────────────────────────────────── */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Campaign" : "New Campaign"}</DialogTitle>
            <DialogDescription>
              Compose your email campaign. Only opted-in contacts will receive it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* Name + Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Campaign Name *</Label>
                <Input
                  id="c-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Holiday Season Kickoff 2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Campaign Type</Label>
                <Select value={form.campaignType} onValueChange={(v) => v && setForm((f) => ({ ...f, campaignType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* From fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-from-name">From Name</Label>
                <Input
                  id="c-from-name"
                  value={form.fromName}
                  onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
                  placeholder={settings?.from_name || "Your Company"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-from-email">From Email *</Label>
                <Input
                  id="c-from-email"
                  type="email"
                  value={form.fromEmail}
                  onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
                  placeholder={settings?.from_email || "hello@yourcompany.com"}
                />
              </div>
            </div>

            {/* Subject + preview */}
            <div className="space-y-1.5">
              <Label htmlFor="c-subject">Subject Line *</Label>
              <Input
                id="c-subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Your 2026 holiday install date is ready to book"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-preview">Preview Text</Label>
              <Input
                id="c-preview"
                value={form.previewText}
                onChange={(e) => setForm((f) => ({ ...f, previewText: e.target.value }))}
                placeholder="Shows in inbox before the email is opened..."
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="c-body">Message Body *</Label>
              <Textarea
                id="c-body"
                value={form.textBody}
                onChange={(e) => setForm((f) => ({ ...f, textBody: e.target.value }))}
                rows={10}
                className="resize-y font-mono text-sm"
                placeholder="Write your email here..."
              />
              <p className="text-[11px] text-muted-foreground">
                Plain text. A compliant HTML version with unsubscribe footer will be generated automatically.
              </p>
            </div>

            {/* Schedule */}
            <div className="space-y-1.5">
              <Label htmlFor="c-schedule">Schedule (optional)</Label>
              <Input
                id="c-schedule"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">Leave blank to save as draft and send manually.</p>
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />{error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setComposerOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSave()} disabled={isPending}>
                {isPending ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Saving...</> : "Save Campaign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o: boolean) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Send confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={!!sendTarget} onOpenChange={(o: boolean) => !o && setSendTarget(null)}>
        <AlertDialogContent className="mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Send campaign now?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{sendTarget?.subject}&rdquo; will be sent to all opted-in contacts who match this segment.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={isPending}>
              {isPending ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Sending...</> : "Send Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
