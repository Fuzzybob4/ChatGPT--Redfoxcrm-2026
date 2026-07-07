"use client";

import { useState } from "react";
import {
  Plus,
  Send,
  Mail,
  Users,
  BarChart3,
  Eye,
  MousePointerClick,
  Clock,
  CheckCircle2,
  Pencil,
  Trash2,
  Copy,
  ChevronRight,
  Megaphone,
  FileText,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

type CampaignStatus = "sent" | "draft" | "scheduled";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  audience: string;
  sentTo: number;
  openRate: number;
  clickRate: number;
  sentAt?: string;
  scheduledFor?: string;
}

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Holiday Season Kickoff",
    subject: "Your lights are ready — book your installation today!",
    status: "sent",
    audience: "All Active Customers",
    sentTo: 412,
    openRate: 58.4,
    clickRate: 14.2,
    sentAt: "Oct 15, 2024",
  },
  {
    id: "c2",
    name: "Early Bird Discount",
    subject: "Book before Nov 1 and save 15%",
    status: "sent",
    audience: "Leads & Inactive",
    sentTo: 87,
    openRate: 42.1,
    clickRate: 9.8,
    sentAt: "Sep 28, 2024",
  },
  {
    id: "c3",
    name: "December Removal Reminder",
    subject: "Schedule your light removal — January slots filling fast",
    status: "scheduled",
    audience: "Installed Customers",
    sentTo: 0,
    openRate: 0,
    clickRate: 0,
    scheduledFor: "Dec 20, 2024",
  },
  {
    id: "c4",
    name: "Spring 2025 Upsell",
    subject: "Add pathway lights to your property this spring",
    status: "draft",
    audience: "All Active Customers",
    sentTo: 0,
    openRate: 0,
    clickRate: 0,
  },
];

const TEMPLATES = [
  {
    id: "t1",
    name: "New Season Announcement",
    description: "Announce holiday lighting season opening with CTA to book",
    category: "Seasonal",
  },
  {
    id: "t2",
    name: "Invoice Follow-Up",
    description: "Gentle reminder for customers with unpaid invoices",
    category: "Billing",
  },
  {
    id: "t3",
    name: "Job Completion Thank You",
    description: "Thank the customer after a completed installation",
    category: "Transactional",
  },
  {
    id: "t4",
    name: "Referral Request",
    description: "Ask satisfied customers to refer a friend for a discount",
    category: "Growth",
  },
  {
    id: "t5",
    name: "Removal Reminder",
    description: "Remind customers to book light removal after the holidays",
    category: "Seasonal",
  },
];

const AUDIENCE_SEGMENTS = [
  { id: "all", name: "All Active Customers", count: 412 },
  { id: "leads", name: "Leads & Inactive", count: 87 },
  { id: "installed", name: "Installed This Season", count: 231 },
  { id: "unpaid", name: "Unpaid Invoices", count: 18 },
  { id: "paid", name: "Paid — No Upsell Yet", count: 163 },
];

const STATUS_STYLE: Record<CampaignStatus, string> = {
  sent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function EmailMarketingPage() {
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [bodyText, setBodyText] = useState("");

  const sentCampaigns = MOCK_CAMPAIGNS.filter((c) => c.status === "sent");
  const totalSent = sentCampaigns.reduce((s, c) => s + c.sentTo, 0);
  const avgOpen = sentCampaigns.length
    ? (sentCampaigns.reduce((s, c) => s + c.openRate, 0) / sentCampaigns.length).toFixed(1)
    : "0";
  const avgClick = sentCampaigns.length
    ? (sentCampaigns.reduce((s, c) => s + c.clickRate, 0) / sentCampaigns.length).toFixed(1)
    : "0";

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Email Marketing"
        description="Create and send campaigns to your customer segments"
        actions={
          <Button size="sm" onClick={() => setComposing(true)}>
            <Plus className="size-3.5 mr-1.5" />
            New Campaign
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Compose Panel */}
        {composing && (
          <Card className="mb-6 border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pencil className="size-4 text-primary" />
                  New Campaign
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>Cancel</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Campaign Name</Label>
                  <Input
                    placeholder="e.g. Holiday Season Kickoff"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Audience Segment</Label>
                  <select
                    className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                    value={selectedSegment}
                    onChange={(e) => setSelectedSegment(e.target.value)}
                  >
                    {AUDIENCE_SEGMENTS.map((seg) => (
                      <option key={seg.id} value={seg.id}>
                        {seg.name} ({seg.count.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Subject Line</Label>
                <Input
                  placeholder="Your subject line..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Message Body</Label>
                <textarea
                  rows={6}
                  placeholder="Write your email content here..."
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-0">
              <Button size="sm" variant="outline">Save as Draft</Button>
              <Button size="sm" variant="outline">
                <Clock className="size-3.5 mr-1.5" />
                Schedule
              </Button>
              <Button size="sm">
                <Send className="size-3.5 mr-1.5" />
                Send Now
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Emails Sent", value: totalSent.toLocaleString(), icon: Mail },
            { label: "Avg Open Rate", value: `${avgOpen}%`, icon: Eye },
            { label: "Avg Click Rate", value: `${avgClick}%`, icon: MousePointerClick },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="py-4 px-5 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Icon className="size-4 text-primary" />
                </span>
                <div>
                  <p className="text-xl font-bold leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="campaigns" className="text-xs px-3">
              <Megaphone className="size-3.5 mr-1.5" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs px-3">
              <FileText className="size-3.5 mr-1.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="audience" className="text-xs px-3">
              <Users className="size-3.5 mr-1.5" />
              Audience
            </TabsTrigger>
          </TabsList>

          {/* Campaigns list */}
          <TabsContent value="campaigns" className="space-y-3">
            {MOCK_CAMPAIGNS.map((campaign) => (
              <Card key={campaign.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{campaign.name}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${STATUS_STYLE[campaign.status]}`}>
                          {campaign.status === "scheduled" && <Clock className="size-2.5 mr-1 inline" />}
                          {campaign.status === "sent" && <CheckCircle2 className="size-2.5 mr-1 inline" />}
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{campaign.subject}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Copy className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {campaign.audience}
                    </span>
                    {campaign.status === "sent" && (
                      <>
                        <span className="flex items-center gap-1">
                          <Send className="size-3" />
                          {campaign.sentTo.toLocaleString()} sent &middot; {campaign.sentAt}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="size-3" />
                          {campaign.openRate}% open
                        </span>
                        <span className="flex items-center gap-1">
                          <MousePointerClick className="size-3" />
                          {campaign.clickRate}% click
                        </span>
                      </>
                    )}
                    {campaign.status === "scheduled" && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        Sends {campaign.scheduledFor}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Templates */}
          <TabsContent value="templates" className="space-y-3">
            {TEMPLATES.map((tpl) => (
              <Card key={tpl.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{tpl.name}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5">{tpl.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{tpl.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={() => { setComposing(true); setCampaignName(tpl.name); }}
                    >
                      Use Template
                      <ChevronRight className="size-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Audience */}
          <TabsContent value="audience" className="space-y-3">
            {AUDIENCE_SEGMENTS.map((seg) => (
              <Card key={seg.id}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <Users className="size-4 text-primary" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{seg.name}</p>
                        <p className="text-xs text-muted-foreground">{seg.count.toLocaleString()} contacts</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => { setComposing(true); setSelectedSegment(seg.id); }}
                    >
                      Send Campaign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
