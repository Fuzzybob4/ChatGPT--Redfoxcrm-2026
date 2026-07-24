"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin, Phone, Mail, CalendarDays, FileText,
  ArrowLeft, Plus, Pencil, Tag, StickyNote,
} from "lucide-react";

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
import { EditCustomerModal } from "@/components/customers/edit-customer-modal";
import { CustomerPhotoGallery } from "@/components/customers/customer-photo-gallery";
import { CustomerPhotoUploader } from "@/components/customers/customer-photo-uploader";
import { CustomerPortalLinkCard } from "@/components/customers/customer-portal-link-card";
import { CustomerProperties } from "@/components/customers/customer-properties";
import { deriveLifecycleStatus, LIFECYCLE_META } from "@/lib/lifecycle";

interface Props {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailPage({ params }: Props) {
  const { id } = use(params);
  const { loading, refresh, getCustomerById, getCustomerJobs, getCustomerInvoices, getCustomerPhotos, getCustomerProperties } = useData();
  const customer = getCustomerById(id);
  const photos = getCustomerPhotos(id);
  const properties = getCustomerProperties(id);
  const [editOpen, setEditOpen] = useState(false);

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

  // Derive the live pipeline status from real invoices + jobs so it stays in
  // sync with the mapping page (both use lib/lifecycle).
  const hasUnpaidInvoice = invs.some(
    (i) => i.status === "Sent" || i.status === "Overdue",
  );
  const hasPaidInvoice = invs.some((i) => i.status === "Paid");
  const lifecycle = deriveLifecycleStatus({
    hasUnpaidInvoice,
    hasPaidInvoice,
    jobs: jobs.map((j) => ({
      status: j.status,
      hasCrew: Boolean(j.technicianName?.trim()),
    })),
    installStatus: customer.installStatus,
  });
  const lifecycleMeta = LIFECYCLE_META[lifecycle];

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const hasCoords = customer.lat != null && customer.lng != null;
  const hasTags = (customer as any).tags?.length > 0;
  const hasNotes = (customer as any).notes?.trim();

  // Build a static map URL for the mini-map (no JS bundle weight)
  const staticMapUrl = hasCoords && mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+dc2626(${customer.lng},${customer.lat})/${customer.lng},${customer.lat},14,0/600x200@2x?access_token=${mapboxToken}`
    : null;

  const fullAddress = [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");

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
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" data-icon="inline-start" />
              Edit Customer
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* ── Left column ── */}
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
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="font-semibold text-base">{customer.name}</p>
                    <StatusBadge status={customer.status} className="mt-1" />
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: lifecycleMeta.color }}
                      title={lifecycleMeta.description}
                    >
                      <span className="inline-block size-1.5 rounded-full bg-white/90" />
                      {lifecycleMeta.label}
                    </span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col gap-2.5 text-sm">
                  {customer.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="size-4 shrink-0 text-primary" />
                      {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Phone className="size-4 shrink-0 text-primary" />
                      {customer.phone}
                    </a>
                  )}
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0 text-primary" />
                    Since{" "}
                    {new Date(customer.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Tags */}
                {hasTags && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Tag className="size-3.5" />
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(customer as any).tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Notes */}
                {hasNotes && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <StickyNote className="size-3.5" />
                        Notes
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {(customer as any).notes}
                      </p>
                    </div>
                  </>
                )}

                <button
                  onClick={() => setEditOpen(true)}
                  className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-md py-2 transition-colors"
                >
                  {hasTags || hasNotes ? "Edit tags & notes" : "Add tags & notes"}
                </button>
              </CardContent>
            </Card>

            {/* Portal Access Card */}
            <CustomerPortalLinkCard 
              customerId={customer.id} 
              customerName={customer.name}
              customerEmail={customer.email}
            />

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

          {/* ── Right column ── */}
          <div className="flex flex-col gap-4 lg:col-span-2">

            {/* Service Address + Mini-Map */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">Service Address</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Primary location for this customer
                    </CardDescription>
                  </div>
                  {customer.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      Open in Maps
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
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
                    <span
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: lifecycleMeta.color }}
                      title={lifecycleMeta.description}
                    >
                      {lifecycleMeta.label}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No address on file
                  </p>
                )}

                {/* Mini-map */}
                {staticMapUrl ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={staticMapUrl}
                      alt={`Map showing location of ${customer.name}`}
                      className="w-full object-cover"
                      style={{ height: 180 }}
                      crossOrigin="anonymous"
                    />
                  </a>
                ) : customer.address && !mapboxToken ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 h-32">
                    <div className="text-center space-y-1 px-4">
                      <MapPin className="size-5 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">
                        Add NEXT_PUBLIC_MAPBOX_TOKEN to enable the map
                      </p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Properties (multi-address) */}
            <CustomerProperties customerId={customer.id} properties={properties} />

            {/* Jobs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  Jobs
                </CardTitle>
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
                      <div
                        key={job.id}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
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
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Invoices
                </CardTitle>
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
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
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

  {/* Photo Gallery */}
  <div className="space-y-4">
    <CustomerPhotoUploader 
      customerId={customer.id}
      onPhotoAdded={() => refresh()}
    />
    <CustomerPhotoGallery photos={photos} />
  </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <EditCustomerModal
        customer={{
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address ?? "",
          city: customer.city ?? "",
          state: customer.state ?? "",
          zip: customer.zip ?? "",
          status: customer.status,
          notes: (customer as any).notes ?? "",
          tags: (customer as any).tags ?? [],
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
