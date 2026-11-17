'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { getEstimateTotal } from '@/lib/data';
import { useData } from '@/lib/data-context';
import { useLocation } from '@/lib/location-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { estimateStage, type EstimateStageKey } from '@/lib/estimate-stage';

type Filter = 'open' | EstimateStageKey | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'approved', label: 'Approved · pending payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'declined', label: 'Declined' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function EstimatesPage() {
  const { selectedLocationId } = useLocation();
  const { loading, estimates, invoices, properties, getCustomerById } = useData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('open');

  const rows = useMemo(() => {
    const invById = new Map(invoices.map((i) => [i.id, i]));
    return (selectedLocationId ? estimates.filter((e) => !e.locationId || e.locationId === selectedLocationId) : estimates).map((est) => {
      const inv = invById.get((est as { invoiceId?: string | null }).invoiceId ?? '');
      const prop = properties.find((p) => p.id === (est as { propertyId?: string }).propertyId);
      const customer = getCustomerById(est.customerId);
      return {
        est,
        customer,
        // The estimate's property address when set, else the customer's address.
        place: prop ? `${prop.propertyName ? `${prop.propertyName} · ` : ''}${prop.address}` : customer?.address ?? '',
        stage: estimateStage(est as never, inv ? { amountPaid: Number((inv as { amountPaid?: number }).amountPaid ?? 0), status: inv.status } : null),
        total: (est as { total?: number }).total ?? getEstimateTotal(est),
      };
    });
  }, [estimates, invoices, properties, selectedLocationId, getCustomerById]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.filter((r) => r.stage.key !== 'archived').length };
    for (const r of rows) c[r.stage.key] = (c[r.stage.key] ?? 0) + 1;
    c.open = (c.draft ?? 0) + (c.sent ?? 0) + (c.approved ?? 0);
    return c;
  }, [rows]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(({ est, customer, stage, place }) => {
    const inFilter =
      filter === 'all'
        ? stage.key !== 'archived'
        : filter === 'open'
          ? ['draft', 'sent', 'approved'].includes(stage.key)
          : stage.key === filter;
    if (!inFilter) return false;
    if (!q) return true;
    return (
      est.estimateNumber.toLowerCase().includes(q) ||
      (customer?.name ?? '').toLowerCase().includes(q) ||
      place.toLowerCase().includes(q) ||
      ((est as { title?: string }).title ?? '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Estimates"
        description={`${filtered.length} estimate${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <Button render={<Link href="/estimates/new" />} size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            New Estimate
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="space-y-4">
          <Input
            placeholder="Search by estimate #, customer, or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11"
          />

          {/* Filters */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {FILTERS.map((f) => {
              const on = filter === f.key;
              const n = counts[f.key] ?? 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={on}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                    on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {f.label}
                  {n > 0 && <span className={`tabular-nums ${on ? 'opacity-90' : 'text-muted-foreground'}`}>{n}</span>}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No estimates here.</p>
              {filter === 'open' && !q && (
                <Button render={<Link href="/estimates/new" />} size="sm">
                  Create an estimate
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Phone: cards */}
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card md:hidden">
                {filtered.map(({ est, customer, stage, total, place }) => (
                  <li key={est.id}>
                    <Link href={`/estimates/${est.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{customer?.name ?? 'Customer'}</span>
                          <span className="ml-auto shrink-0 font-semibold tabular-nums">{usd(total)}</span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {est.estimateNumber}
                          {est.createdDate ? ` · ${format(new Date(`${est.createdDate}T12:00:00`), 'MMM d')}` : ''}
                          {place ? ` · ${place}` : ''}
                        </p>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stage.chip}`}>{stage.label}</span>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Estimate #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right"><span className="sr-only">Open</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(({ est, customer, stage, total, place }) => (
                      <TableRow key={est.id}>
                        <TableCell className="font-mono text-sm font-semibold">{est.estimateNumber}</TableCell>
                        <TableCell>{customer?.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{place || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {est.createdDate ? format(new Date(`${est.createdDate}T12:00:00`), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">{usd(total)}</TableCell>
                        <TableCell>
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${stage.chip}`}>{stage.label}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button render={<Link href={`/estimates/${est.id}`} />} variant="outline" size="sm">
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
