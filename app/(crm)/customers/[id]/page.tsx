"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Phone, Mail, CalendarDays, FileText, ArrowLeft, Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { getInvoiceTotal } from "@/lib/data";
import { useData } from "@/lib/data-context";

interface Props {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailPage({ params }: Props) {
  const { id } = use(params);
  const { loading, getCustomerById, getCustomerJobs, getCustomerInvoices } = useData();
  const customer = getCustomerById(id);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!customer) notFound();

  const jobs = getCustomerJobs(customer.id);
  const invs = getCustomerInvoices(customer.id);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title={customer.name}
        description={customer.email}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/customers" />}
            >
              <ArrowLeft className="size-3.5" data-icon="inline-start" />
              Back
            </Button>
            <Button size="sm">Edit Customer</Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            {/* Contact card */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex flex-col items-center text-center gap-3">
                  <Avatar className="size-14">
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                      {customer.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-base">{customer.name}</p>
                    <StatusBadge status={customer.status} className="mt-1" />
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="flex flex-col gap-2.5 text-sm">
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="size-4 shrink-0 text-primary" />
                    {customer.email}
                  </a>
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="size-4 shrink-0 text-primary" />
                    {customer.phone}
                  </a>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0 text-primary" />
                    Since{" "}
                    {new Date(customer.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Account Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{jobs.length}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Jobs</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{invs.length}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Invoices</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* Service Address */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Service Address</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Primary location for this customer
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {customer.address ? (
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                      <MapPin className="size-4 text-primary" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{customer.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {[customer.city, customer.state].filter(Boolean).join(", ")}
                        {customer.zip ? ` ${customer.zip}` : ""}
                      </p>
                    </div>
                    {customer.installStatus && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {customer.installStatus}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No address on file
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Jobs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" />
                    Jobs
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/jobs/new?customer=${customer.id}`} />}
                >
                  <Plus className="size-3.5" data-icon="inline-start" />
                  Schedule
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {jobs.length > 0 ? (
                  <div className="flex flex-col divide-y divide-border">
                    {jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.scheduledDate).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            at {job.scheduledTime} &middot; {job.technicianName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-foreground">
                            ${job.amount}
                          </span>
                          <StatusBadge status={job.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No jobs yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Invoices */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    Invoices
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/invoices/new?customer=${customer.id}`} />}
                >
                  <Plus className="size-3.5" data-icon="inline-start" />
                  New Invoice
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {invs.length > 0 ? (
                  <div className="flex flex-col divide-y divide-border">
                    {invs.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            Due{" "}
                            {new Date(inv.dueDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold">
                            ${getInvoiceTotal(inv).toLocaleString()}
                          </span>
                          <StatusBadge status={inv.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No invoices yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
