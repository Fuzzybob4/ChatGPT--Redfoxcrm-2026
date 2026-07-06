import Link from "next/link";
import {
  DollarSign,
  Users,
  CalendarDays,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Clock,
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

import {
  getDashboardStats,
  jobs,
  invoices,
  getCustomerById,
  getInvoiceTotal,
} from "@/lib/data";

export default function DashboardPage() {
  const stats = getDashboardStats();

  const upcomingJobs = jobs
    .filter((j) => j.status === "Scheduled" || j.status === "In Progress")
    .slice(0, 5);

  const recentInvoices = [...invoices]
    .sort(
      (a, b) =>
        new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime()
    )
    .slice(0, 5);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Dashboard"
        description="Welcome back, Alex"
        actions={
          <Button size="sm" render={<Link href="/jobs/new" />}>
            + New Job
          </Button>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
