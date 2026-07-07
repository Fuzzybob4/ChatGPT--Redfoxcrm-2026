"use client";

import { useState } from "react";
import {
  CalendarDays,
  FileText,
  MapPin,
  CheckCircle,
  Clock,
  Download,
  Star,
  MessageSquare,
  CreditCard,
  Package,
  ChevronRight,
  Sparkles,
  Phone,
  Mail,
  AlertCircle,
  Plus,
  Minus,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { getInvoiceTotal } from "@/lib/data";
import { useData } from "@/lib/data-context";

// Optional upsell services customers can add when paying
const UPSELL_SERVICES = [
  {
    id: "upsell-1",
    name: "Pathway Light Upgrade",
    description: "Upgrade to premium color-changing LED pathway lights",
    price: 349,
    popular: true,
  },
  {
    id: "upsell-2",
    name: "Tree Wrap Add-On",
    description: "Wrap up to 2 additional trees with warm white lights",
    price: 199,
  },
  {
    id: "upsell-3",
    name: "Extended Season Storage",
    description: "We store your lights year-round in climate-controlled facility",
    price: 89,
  },
];

export default function CustomerPortalPage() {
  const { loading, customers, getCustomerJobs, getCustomerInvoices } = useData();
  const customer = customers[0];

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [selectedUpsells, setSelectedUpsells] = useState<Set<string>>(new Set());
  const [paymentStep, setPaymentStep] = useState<"select" | "upsells" | "confirm" | "done">("select");
  const [paidInvoices, setPaidInvoices] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <PageHeader
          title="Customer Portal"
          description="Preview: how customers see their account"
        />
        <div className="flex-1 flex items-center justify-center p-10">
          <p className="text-sm text-muted-foreground">
            No customers yet. Add a customer to preview the portal.
          </p>
        </div>
      </div>
    );
  }

  const jobs = getCustomerJobs(customer.id);
  const invoices = getCustomerInvoices(customer.id);

  const upcomingJobs = jobs.filter(
    (j) => j.status === "Scheduled" || j.status === "In Progress"
  );
  const pastJobs = jobs.filter(
    (j) => j.status === "Completed" || j.status === "Cancelled"
  );
  const unpaidInvoices = invoices.filter(
    (i) => !paidInvoices.has(i.id) && (i.status === "Sent" || i.status === "Overdue")
  );

  const currentInvoice = invoices.find((i) => i.id === payingInvoiceId);
  const invoiceBase = currentInvoice ? getInvoiceTotal(currentInvoice) : 0;
  const upsellTotal = UPSELL_SERVICES.filter((u) => selectedUpsells.has(u.id))
    .reduce((s, u) => s + u.price, 0);
  const grandTotal = invoiceBase + upsellTotal;

  function toggleUpsell(id: string) {
    setSelectedUpsells((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startPayment(invoiceId: string) {
    setPayingInvoiceId(invoiceId);
    setSelectedUpsells(new Set());
    setPaymentStep("upsells");
  }

  function confirmPayment() {
    if (!payingInvoiceId) return;
    setPaidInvoices((prev) => new Set([...prev, payingInvoiceId]));
    setPaymentStep("done");
  }

  function resetPayment() {
    setPayingInvoiceId(null);
    setPaymentStep("select");
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Customer Portal"
        description="Preview: how customers see their account"
      />

      <div className="flex-1 overflow-y-auto bg-muted/30">
        {/* Hero banner */}
        <div className="bg-primary text-primary-foreground px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 border-2 border-primary-foreground/30">
                <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-lg font-bold">
                  {customer.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-primary-foreground/70 font-medium">Welcome back</p>
                <h2 className="text-xl font-bold">{customer.name}</h2>
                <p className="text-sm text-primary-foreground/70">{customer.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{upcomingJobs.length}</p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">Upcoming Jobs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{pastJobs.length}</p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">Completed Jobs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{unpaidInvoices.length}</p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">Invoices Due</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {/* Unpaid invoice alert */}
          {unpaidInvoices.length > 0 && paymentStep === "select" && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="size-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        {unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? "s" : ""} awaiting payment
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Total due: ${unpaidInvoices.reduce((s, i) => s + getInvoiceTotal(i), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-0"
                    onClick={() => startPayment(unpaidInvoices[0].id)}
                  >
                    Pay Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Payment Flow ─────────────────────────────────────── */}
          {paymentStep === "upsells" && currentInvoice && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Enhance Your Installation
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={resetPayment} className="text-xs">
                    Cancel
                  </Button>
                </div>
                <CardDescription className="text-xs">
                  Add optional services to your order — no hassle, billed with your invoice.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {UPSELL_SERVICES.map((svc) => (
                  <div
                    key={svc.id}
                    className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                      selectedUpsells.has(svc.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => toggleUpsell(svc.id)}
                  >
                    <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      selectedUpsells.has(svc.id) ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}>
                      {selectedUpsells.has(svc.id) && <CheckCircle className="size-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{svc.name}</p>
                        {svc.popular && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                            Popular
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                    </div>
                    <p className="text-sm font-semibold shrink-0">+${svc.price}</p>
                  </div>
                ))}

                <Separator />

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Invoice ({currentInvoice.invoiceNumber})</span>
                    <span>${invoiceBase.toLocaleString()}</span>
                  </div>
                  {upsellTotal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Add-ons</span>
                      <span>+${upsellTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
                    <span>Total</span>
                    <span>${grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 pt-0">
                <Button className="flex-1" onClick={() => setPaymentStep("confirm")}>
                  <CreditCard className="size-4 mr-2" />
                  Continue to Payment
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPaymentStep("confirm")} className="text-xs text-muted-foreground">
                  Skip add-ons
                </Button>
              </CardFooter>
            </Card>
          )}

          {paymentStep === "confirm" && currentInvoice && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  Confirm Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                  {currentInvoice.lineItems.map((li, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{li.description}</span>
                      <span>${(li.quantity * li.unitPrice).toLocaleString()}</span>
                    </div>
                  ))}
                  {UPSELL_SERVICES.filter((u) => selectedUpsells.has(u.id)).map((u) => (
                    <div key={u.id} className="flex justify-between text-primary">
                      <span>{u.name}</span>
                      <span>+${u.price}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total Due</span>
                    <span>${grandTotal.toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  You will be redirected to our secure Stripe payment page.
                </p>
              </CardContent>
              <CardFooter className="flex gap-2 pt-0">
                <Button variant="outline" size="sm" onClick={() => setPaymentStep("upsells")}>
                  Back
                </Button>
                <Button className="flex-1" onClick={confirmPayment}>
                  Pay ${grandTotal.toLocaleString()} Securely
                </Button>
              </CardFooter>
            </Card>
          )}

          {paymentStep === "done" && (
            <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
              <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
                <div className="size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <CheckCircle className="size-7 text-emerald-600" />
                </div>
                <p className="font-bold text-lg text-emerald-900 dark:text-emerald-200">Payment Successful!</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  A receipt has been emailed to {customer.email}
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={resetPayment}>
                  Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Main Tabs ─────────────────────────────────────────── */}
          <Tabs defaultValue="jobs" className="space-y-4">
            <TabsList className="h-9">
              <TabsTrigger value="jobs" className="text-xs px-3">Jobs</TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs px-3">
                Invoices
                {unpaidInvoices.length > 0 && (
                  <Badge className="ml-1.5 text-[9px] px-1 h-4 bg-amber-500 text-white border-0">
                    {unpaidInvoices.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="properties" className="text-xs px-3">Address</TabsTrigger>
              <TabsTrigger value="feedback" className="text-xs px-3">Feedback</TabsTrigger>
              <TabsTrigger value="support" className="text-xs px-3">Support</TabsTrigger>
            </TabsList>

            {/* Jobs */}
            <TabsContent value="jobs" className="space-y-5">
              {upcomingJobs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h3>
                  <div className="flex flex-col gap-3">
                    {upcomingJobs.map((job) => (
                      <Card key={job.id}>
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="font-medium text-sm">{job.title}</p>
                                <StatusBadge status={job.status} />
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="size-3" />
                                  {new Date(job.scheduledDate + "T" + job.scheduledTime).toLocaleDateString("en-US", {
                                    weekday: "short", month: "short", day: "numeric",
                                  })}{" "}at {job.scheduledTime}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  ~{job.durationMins} min
                                </span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">{job.serviceType}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {pastJobs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">History</h3>
                  <div className="flex flex-col gap-2">
                    {pastJobs.map((job) => (
                      <Card key={job.id} className="opacity-70 hover:opacity-100 transition-opacity">
                        <CardContent className="py-3 px-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">{job.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(job.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </div>
                            <StatusBadge status={job.status} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Invoices */}
            <TabsContent value="invoices" className="space-y-3">
              {invoices.map((inv) => {
                const total = getInvoiceTotal(inv);
                const isPaid = paidInvoices.has(inv.id) || inv.status === "Paid";
                return (
                  <Card key={inv.id}>
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Issued {new Date(inv.issuedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" "}&middot; Due {new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">${total.toLocaleString()}</p>
                          {isPaid ? (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-[10px] mt-1">Paid</Badge>
                          ) : (
                            <StatusBadge status={inv.status} className="mt-1" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        {!isPaid && (inv.status === "Sent" || inv.status === "Overdue") ? (
                          <>
                            <Button size="sm" className="text-xs" onClick={() => startPayment(inv.id)}>
                              <CreditCard className="size-3.5 mr-1" />
                              Pay ${total.toLocaleString()}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs">
                              <Download className="size-3.5 mr-1" />
                              PDF
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle className="size-3.5" />
                              Paid in full
                            </span>
                            <Button size="sm" variant="ghost" className="ml-auto text-xs">
                              <Download className="size-3.5 mr-1" />
                              PDF
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Service Address */}
            <TabsContent value="properties" className="space-y-3">
              {customer.address ? (
                <Card>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                        <MapPin className="size-4 text-primary" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{customer.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {[customer.city, customer.state].filter(Boolean).join(", ")}
                          {customer.zip ? ` ${customer.zip}` : ""}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No address on file
                </p>
              )}
            </TabsContent>

            {/* Feedback */}
            <TabsContent value="feedback">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="size-4 text-primary" />
                    Leave a Review
                  </CardTitle>
                  <CardDescription className="text-xs">
                    How was your recent service? Your feedback helps us improve.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {submitted ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <CheckCircle className="size-10 text-emerald-500" />
                      <p className="font-semibold text-base">Thank you!</p>
                      <p className="text-sm text-muted-foreground">Your review has been submitted.</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium mb-2">Overall Rating</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setHoveredRating(star)}
                              onMouseLeave={() => setHoveredRating(0)}
                              aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                            >
                              <Star className={`size-7 transition-colors ${star <= (hoveredRating || rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Comments</p>
                        <Textarea
                          placeholder="Tell us about your experience..."
                          value={review}
                          onChange={(e) => setReview(e.target.value)}
                          className="min-h-24 resize-none"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
                {!submitted && (
                  <CardFooter className="pt-0">
                    <Button onClick={() => rating > 0 && setSubmitted(true)} disabled={rating === 0}>
                      Submit Review
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </TabsContent>

            {/* Support */}
            <TabsContent value="support" className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Contact Us</CardTitle>
                  <CardDescription className="text-xs">Reach out and we will get back to you quickly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Phone className="size-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Call Us</p>
                      <p className="text-xs text-muted-foreground">(512) 555-0000 &middot; Mon–Fri 8am–6pm</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="size-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Email Support</p>
                      <p className="text-xs text-muted-foreground">support@redfoxcrm.com</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Send a Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea placeholder="Describe your question or issue..." className="min-h-24 resize-none" />
                </CardContent>
                <CardFooter className="pt-0">
                  <Button size="sm">Send Message</Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
