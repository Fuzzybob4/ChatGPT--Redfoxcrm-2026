'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  DollarSign,
  Users,
  CalendarDays,
  CheckCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useData } from '@/lib/data-context';
import { useOrgContext } from '@/lib/org-context';

interface LocationStats {
  id: string;
  name: string;
  totalRevenue: number;
  outstandingRevenue: number;
  activeCustomers: number;
  scheduledJobs: number;
  completedJobs: number;
}

export default function MultiLocationDashboard() {
  const { loading, locations, getDashboardStats, getLocationById } = useData();
  const org = useOrgContext();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Calculate stats for all locations
  const locationStats: LocationStats[] = locations.map((loc) => {
    const stats = getDashboardStats(loc.id);
    return {
      id: loc.id,
      name: loc.name,
      ...stats,
    };
  });

  // Calculate organization totals
  const orgTotals = locationStats.reduce(
    (acc, loc) => ({
      totalRevenue: acc.totalRevenue + loc.totalRevenue,
      outstandingRevenue: acc.outstandingRevenue + loc.outstandingRevenue,
      activeCustomers: acc.activeCustomers + loc.activeCustomers,
      scheduledJobs: acc.scheduledJobs + loc.scheduledJobs,
      completedJobs: acc.completedJobs + loc.completedJobs,
    }),
    {
      totalRevenue: 0,
      outstandingRevenue: 0,
      activeCustomers: 0,
      scheduledJobs: 0,
      completedJobs: 0,
    }
  );

  const selectedStats = selectedLocationId
    ? locationStats.find((s) => s.id === selectedLocationId)
    : null;

  const displayStats = selectedStats || orgTotals;

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
        title="Multi-Location Dashboard"
        description="Compare performance across all locations"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Location Filter Tabs */}
        <Tabs
          value={selectedLocationId || 'all'}
          onValueChange={(v) => setSelectedLocationId(v === 'all' ? '' : v)}
          className="mb-6"
        >
          <TabsList className="grid grid-cols-2 md:grid-cols-auto md:inline-grid gap-2">
            <TabsTrigger value="all">All Locations</TabsTrigger>
            {locations.map((loc) => (
              <TabsTrigger key={loc.id} value={loc.id}>
                {loc.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
          <StatCard
            title="Revenue (Paid)"
            value={`$${displayStats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            accent
            trendLabel={selectedLocationId ? 'This location' : 'Organization total'}
          />
          <StatCard
            title="Outstanding"
            value={`$${displayStats.outstandingRevenue.toLocaleString()}`}
            icon={TrendingUp}
            trend="down"
            trendLabel="Awaiting payment"
          />
          <StatCard
            title="Active Customers"
            value={displayStats.activeCustomers}
            icon={Users}
            trendLabel="Total accounts"
          />
          <StatCard
            title="Jobs Scheduled"
            value={displayStats.scheduledJobs}
            icon={CalendarDays}
            trendLabel={`${displayStats.completedJobs} completed`}
          />
        </div>

        {/* Location Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Location Performance Comparison
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Key metrics across all locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-muted-foreground">
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Scheduled</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationStats.map((stat) => (
                    <TableRow key={stat.id}>
                      <TableCell className="font-medium text-sm">
                        {stat.name}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        ${stat.totalRevenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm text-amber-600">
                        ${stat.outstandingRevenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {stat.activeCustomers}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {stat.scheduledJobs}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {stat.completedJobs}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/dashboard?location=${stat.id}`} />}
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Growth Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Strongest Location (Revenue)
                </p>
                <p className="font-semibold">
                  {locationStats.length > 0
                    ? locationStats.reduce((max, loc) =>
                        loc.totalRevenue > max.totalRevenue ? loc : max
                      ).name
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Most Active Location (Customers)
                </p>
                <p className="font-semibold">
                  {locationStats.length > 0
                    ? locationStats.reduce((max, loc) =>
                        loc.activeCustomers > max.activeCustomers ? loc : max
                      ).name
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Total Locations
                </p>
                <p className="font-semibold">{locations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
