"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useData } from "@/lib/data-context";
import { createJob } from "../actions";

export default function NewJobPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerId = searchParams.get("customer");
  const { getCustomerById } = useData();
  const customer = customerId ? getCustomerById(customerId) : null;

  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    title: "",
    jobType: "install" as "install" | "removal" | "other",
    scheduledDate: "",
    startTime: "08:00",
    endTime: "12:00",
    address: customer?.address ?? "",
    city: customer?.city ?? "",
    state: customer?.state ?? "",
    zipCode: customer?.zipCode ?? "",
    crewName: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !customer) return;

    startTransition(async () => {
      try {
        const jobId = await createJob({
          customerId,
          title: formData.title,
          jobType: formData.jobType,
          scheduledDate: formData.scheduledDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          crewName: formData.crewName || undefined,
          notes: formData.notes || undefined,
        });

        router.push("/jobs");
      } catch (error) {
        console.error("Failed to create job:", error);
      }
    });
  };

  if (!customer) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          breadcrumbs={[
            { label: "Jobs", href: "/jobs" },
            { label: "New Job" },
          ]}
          title="Create Work Order"
        />
        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                No customer selected. Please select a customer to create a work order.
              </p>
              <Button asChild>
                <Link href="/jobs">Back to Jobs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Jobs", href: "/jobs" },
          { label: "New Job" },
        ]}
        title={`Create Work Order for ${customer.name}`}
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Work Order Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Title</label>
                  <Input
                    placeholder="e.g., Install water heater, Repair HVAC"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                {/* Job Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Type</label>
                  <Select value={formData.jobType} onValueChange={(v) => setFormData({ ...formData, jobType: v as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="install">Install</SelectItem>
                      <SelectItem value="removal">Removal</SelectItem>
                      <SelectItem value="other">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Scheduled Date</label>
                    <Input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="hidden sm:block" />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Time</label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Time</label>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Address</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Street Address</label>
                    <Input
                      placeholder="123 Main St"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">City</label>
                      <Input
                        placeholder="City"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">State</label>
                      <Input
                        placeholder="TX"
                        maxLength={2}
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground">Zip Code</label>
                      <Input
                        placeholder="12345"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Crew */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Crew / Technician (Optional)</label>
                  <Input
                    placeholder="Enter crew name"
                    value={formData.crewName}
                    onChange={(e) => setFormData({ ...formData, crewName: e.target.value })}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (Optional)</label>
                  <Textarea
                    placeholder="Add any special instructions or notes for this work order..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" asChild type="button">
                    <Link href="/jobs">Cancel</Link>
                  </Button>
                  <Button className="flex-1" type="submit" disabled={isPending || !formData.title || !formData.scheduledDate}>
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Work Order"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
