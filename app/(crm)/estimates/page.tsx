'use client';

import Link from 'next/link';
import { estimates, getEstimateTotal, getCustomerById, getPropertyById, EstimateStatus } from '@/lib/data';
import { useLocation } from '@/lib/location-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectItem, SelectGroup } from '@/components/ui/select';
import { useState } from 'react';
import { Plus, Eye, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig: Record<EstimateStatus, { label: string; variant: 'default' | 'secondary' | 'outline'; color: string }> = {
  Draft: { label: 'Draft', variant: 'outline', color: 'text-gray-600' },
  Sent: { label: 'Sent', variant: 'secondary', color: 'text-blue-600' },
  Accepted: { label: 'Accepted', variant: 'default', color: 'text-green-600' },
  Rejected: { label: 'Rejected', variant: 'secondary', color: 'text-red-600' },
  Converted: { label: 'Converted', variant: 'default', color: 'text-purple-600' },
};

export default function EstimatesPage() {
  const { selectedLocationId } = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | 'all'>('all');

  // Filter estimates by location
  const locationEstimates = estimates.filter((e) => e.locationId === selectedLocationId);

  // Apply filters
  const filtered = locationEstimates.filter((est) => {
    const customer = getCustomerById(est.customerId);
    const property = getPropertyById(est.propertyId);
    const searchTerm = search.toLowerCase();

    const matchesSearch =
      est.estimateNumber.toLowerCase().includes(searchTerm) ||
      customer?.name.toLowerCase().includes(searchTerm) ||
      property?.address.toLowerCase().includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || est.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Estimates"
        description={`${filtered.length} estimate${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <Button
            render={<Link href="/estimates/new" />}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Estimate
          </Button>
        }
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-col sm:flex-row">
            <Input
              placeholder="Search by estimate #, customer, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EstimateStatus | 'all')}>
              <SelectGroup>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Converted">Converted</SelectItem>
              </SelectGroup>
            </Select>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3">
              <p className="text-muted-foreground">No estimates found</p>
              <Button
                render={<Link href="/estimates/new" />}
                size="sm"
                className="bg-primary hover:bg-primary/90 inline-block"
              >
                Create your first estimate
              </Button>
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Estimate #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((est) => {
                    const customer = getCustomerById(est.customerId);
                    const property = getPropertyById(est.propertyId);
                    const config = statusConfig[est.status];

                    return (
                      <TableRow key={est.id}>
                        <TableCell className="font-mono text-sm font-semibold text-foreground">
                          {est.estimateNumber}
                        </TableCell>
                        <TableCell className="text-foreground">{customer?.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{property?.address}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(est.createdDate), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          ${getEstimateTotal(est).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              render={<Link href={`/estimates/${est.id}`} />}
                              variant="outline"
                              size="sm"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {est.status === 'Draft' && (
                              <Button
                                render={<Link href={`/estimates/${est.id}/edit`} />}
                                variant="outline"
                                size="sm"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
