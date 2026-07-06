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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import {
  customers,
  getCustomerJobs,
  getCustomerInvoices,
  getCustomerProperties,
  getInvoiceTotal,
} from "@/lib/data";

// Portal is demoed for Sandra Martinez (cust-1)
const PORTAL_CUSTOMER_ID = "cust-1";

export default function CustomerPortalPage() {
  const customer = customers.find((c) => c.id === PORTAL_CUSTOMER_ID)!;
  const jobs = getCustomerJobs(PORTAL_CUSTOMER_ID);
  const invoices = getCustomerInvoices(PORTAL_CUSTOMER_ID);
  const properties = getCustomerProperties(PORTAL_CUSTOMER_ID);

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const upcomingJobs = jobs.filter(
    (j) => j.status === "Scheduled" || j.status === "In Progress"
  );
  const pastJobs = jobs.filter(
    (j) => j.status === "Completed" || j.status === "Cancelled"
  );
  const unpaidInvoices = invoices.filter(
    (i) => i.status === "Sent" || i.status === "Overdue"
  );

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Customer Portal"
        description="Preview: how customers see their account"
      />

      <div className="flex-1 overflow-y-auto bg-muted/40">
        {/* Portal hero banner */}
        <div className="bg-primary text-primary-foreground px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 border-2 border-primary-foreground/30">
                <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-lg font-bold">
                  {customer.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-primary-foreground/70 font-medium">
                  Welcome back
                </p>
                <h2 className="text-xl font-bold text-primary-foreground">
                  {customer.name}
                </h2>
                <p className="text-sm text-primary-foreground/70">
                  {customer.email}
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-foreground">
                  {upcomingJobs.length}
                </p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">
                  Upcoming Jobs
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-foreground">
                  {properties.length}
                </p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">
                  Properties
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-foreground">
                  {unpaidInvoices.length}
                </p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">
                  Invoices Due
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Unpaid invoice alert */}
          {unpaidInvoices.length > 0 && (
            <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        You have {unpaidInvoices.length} invoice
                        {unpaidInvoices.length !== 1 ? "s" : ""} awaiting payment
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Total due: $
                        {unpaidInvoices
                          .reduce((s, i) => s + getInvoiceTotal(i), 0)
                          .toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-0"
                  >
                    Pay Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="jobs" className="space-y-4">
            <TabsList className="h-9">
              <TabsTrigger value="jobs" className="text-xs px-3">
                Jobs
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs px-3">
                Invoices
              </TabsTrigger>
              <TabsTrigger value="properties" className="text-xs px-3">
                Properties
              </TabsTrigger>
              <TabsTrigger value="feedback" className="text-xs px-3">
                Feedback
              </TabsTrigger>
            </TabsList>

            {/* Jobs tab */}
            <TabsContent value="jobs" className="space-y-5">
              {upcomingJobs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Upcoming
                  </h3>
                  <div className="flex flex-col gap-3">
                    {upcomingJobs.map((job) => (
                      <Card key={job.id}>
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm">
                                  {job.title}
                                </p>
                                <StatusBadge status={job.status} />
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="size-3" />
                                  {new Date(
                                    job.scheduledDate + "T" + job.scheduledTime
                                  ).toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}{" "}
                                  at {job.scheduledTime}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  ~{job.durationMins} min
                                </span>
                              </div>
                              {job.notes && (
                                <p className="text-xs text-muted-foreground mt-1.5 italic">
                                  Note: {job.notes}
                                </p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {job.serviceType}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {pastJobs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Past
                  </h3>
                  <div className="flex flex-col gap-3">
                    {pastJobs.map((job) => (
                      <Card
                        key={job.id}
                        className="opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <CardContent className="py-3 px-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">{job.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(job.scheduledDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric", year: "numeric" }
                                )}
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

            {/* Invoices tab */}
            <TabsContent value="invoices" className="space-y-3">
              {invoices.map((inv) => {
                const total = getInvoiceTotal(inv);
                return (
                  <Card key={inv.id}>
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">
                            {inv.invoiceNumber}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Issued{" "}
                            {new Date(inv.issuedDate).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric", year: "numeric" }
                            )}{" "}
                            &middot; Due{" "}
                            {new Date(inv.dueDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            ${total.toLocaleString()}
                          </p>
                          <StatusBadge status={inv.status} className="mt-1" />
                        </div>
                      </div>
                      {(inv.status === "Sent" || inv.status === "Overdue") && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <Button size="sm" className="text-xs">
                            Pay ${total.toLocaleString()}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                          >
                            <Download className="size-3.5 mr-1" />
                            PDF
                          </Button>
                        </div>
                      )}
                      {inv.status === "Paid" && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle className="size-3.5" />
                            Paid in full
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto text-xs"
                          >
                            <Download className="size-3.5 mr-1" />
                            PDF
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Properties tab */}
            <TabsContent value="properties" className="space-y-3">
              {properties.map((prop) => (
                <Card key={prop.id}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                        <MapPin className="size-4 text-primary" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{prop.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {prop.city}, {prop.state} {prop.zip}
                        </p>
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {prop.serviceType}
                        </Badge>
                        {prop.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {prop.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Feedback tab */}
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
                      <p className="text-sm text-muted-foreground">
                        Your review has been submitted.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Star rating */}
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Overall Rating
                        </p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setHoveredRating(star)}
                              onMouseLeave={() => setHoveredRating(0)}
                              className="transition-colors"
                              aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                            >
                              <Star
                                className={`size-7 transition-colors ${
                                  star <= (hoveredRating || rating)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Comments */}
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
                    <Button
                      onClick={() => rating > 0 && setSubmitted(true)}
                      disabled={rating === 0}
                      className="w-full sm:w-auto"
                    >
                      Submit Review
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
