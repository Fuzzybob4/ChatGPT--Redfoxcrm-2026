'use client';

import Link from "next/link";
import useSWR from "swr";
import {
  DollarSign,
  Users,
  CalendarDays,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Clock,
  MapPin,
  Truck,
  Route,
  Activity,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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
import { Separator } from "@/components/ui/separator";

import { getInvoiceTotal } from "@/lib/data";
import { useData } from "@/lib/data-context";
import { useLocation } from "@/lib/location-context";
import { useOrgContext } from "@/lib/org-context";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardPage() {
  const { selectedLocationId } = useLocation();
  const { loading, getDashboardStats, getCustomerById, getLocationJobs, invoices, locations } = useData();
  const org = useOrgContext();
  const stats = getDashboardStats(selectedLocationId);

  // Fleet metrics — only loaded when fleet_management add-on is active
  const hasFleet = org.addonIds?.includes('fleet_management');
  const { data: fleetData } = useSWR(
    hasFleet ? '/api/fleet/snapshot' : null,
    fetcher,
    { refreshInterval: 30000 }
  );
  const fleetEmployees: Array<{ employee_id: string; name: string; work_order: { status: string } | null; speed_mps: number | null; last_update: string }> = fleetData?.employees ?? [];
  const activeCount = fleetEmployees.filter((e) => e.work_order?.status === 'in_progress').length;
  const drivingCount = fleetEmployees.filter((e) => e.speed_mps != null && e.speed_mps > 0.5).length;
  const onlineCount = fleetEmployees.length;

  const locationJobs = getLocationJobs(selectedLocationId);
  const locationInvoices = selectedLocationId
    ? invoices.filter((i) => i.locationId === selectedLocationId)
    : invoices;

  const upcomingJobs = locationJobs
    .filter((j) => j.status === "Scheduled" || j.status === "In Progress")
    .slice(0, 5);

  const recentInvoices = [...locationInvoices]
    .sort(
      (a, b) =>
        new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime()
    )
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Dashboard"
        description="Welcome back"
        actions={
          <div className="flex items-center gap-2">
            {(org.isEnterprise || org.locationCount > 1) && locations.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                render={<Link href="/dashboard/multi-location" />}
              >
                Compare Locations
              </Button>
            )}
            <Button size="sm" render={<Link href="/jobs/new" />}>
              + New Job
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Revenue (Paid)"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            accent
            trendLabel="This period"
          />
          <StatCard
            title="Outstanding"
            value={`$${stats.outstandingRevenue.toLocaleString()}`}
            icon={AlertCircle}
            trend="down"
            trendLabel="Awaiting payment"
          />
          <StatCard
            title="Active Customers"
            value={stats.activeCustomers}
            icon={Users}
            trendLabel="Total accounts"
          />
          <StatCard
            title="Jobs Scheduled"
            value={stats.scheduledJobs}
            icon={CalendarDays}
            trendLabel={`${stats.completedJobs} completed`}
          />
        </div>

        {/* Fleet metrics row — only shown when fleet add-on is active */}
        {hasFleet && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Truck className="size-3.5" />
                Fleet — Live
              </p>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/fleet" className="flex items-center gap-1 text-xs" />}
              >
                Open map <ArrowRight className="size-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                title="Crew Online"
                value={onlineCount}
                icon={MapPin}
                trendLabel="Sharing location"
              />
              <StatCard
                title="On a Job"
                value={activeCount}
                icon={Activity}
                trendLabel="In progress"
              />
              <StatCard
                title="In Transit"
                value={drivingCount}
                icon={Route}
                trendLabel="Currently driving"
              />
              <StatCard
                title="Idle"
                value={Math.max(0, onlineCount - activeCount - drivingCount)}
                icon={Clock}
                trendLabel="Between jobs"
              />
            </div>
          </div>
        )}

        {/* Main content row */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Upcoming Jobs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Upcoming Jobs
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Scheduled &amp; in-progress
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/jobs" className="flex items-center gap-1 text-xs" />}
              >
                View all <ArrowRight className="size-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col divide-y divide-border">
                {upcomingJobs.map((job) => {
                  const customer = getCustomerById(job.customerId);
                  return (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Clock className="size-4 text-muted-foreground" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {job.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {customer?.name} &middot;{" "}
                          {new Date(
                            job.scheduledDate + "T" + job.scheduledTime
                          ).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          at {job.scheduledTime}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  );
                })}
                {upcomingJobs.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No upcoming jobs
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Recent Invoices
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Latest billing activity
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/invoices" className="flex items-center gap-1 text-xs" />}
              >
                View all <ArrowRight className="size-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col divide-y divide-border">
                {recentInvoices.map((invoice) => {
                  const customer = getCustomerById(invoice.customerId);
                  const total = getInvoiceTotal(invoice);
                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                          {customer?.name.slice(0, 2).toUpperCase() ?? "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {customer?.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">
                          ${total.toLocaleString()}
                        </p>
                        <StatusBadge status={invoice.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick-action bar */}
        <div className="mt-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/customers/new" />}
                >
                  <Users className="size-3.5" data-icon="inline-start" />
                  Add Customer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/jobs/new" />}
                >
                  <CalendarDays className="size-3.5" data-icon="inline-start" />
                  Schedule Job
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/invoices/new" />}
                >
                  <DollarSign className="size-3.5" data-icon="inline-start" />
                  Create Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/portal" />}
                >
                  <CheckCircle className="size-3.5" data-icon="inline-start" />
                  Customer Portal
                </Button>
                {hasFleet && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/fleet" />}
                  >
                    <Truck className="size-3.5" data-icon="inline-start" />
                    Fleet Map
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
