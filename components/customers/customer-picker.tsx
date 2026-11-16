'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface PickableCustomer {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

/**
 * Search-as-you-type customer picker. Works with thousands of customers on a
 * phone: shows the picked customer as a card, or a search box with the best
 * few matches (name, address, phone or email).
 */
export function CustomerPicker({
  customers,
  value,
  onChange,
  label = 'Customer',
}: {
  customers: PickableCustomer[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const picked = customers.find((c) => c.id === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, '');
    return customers
      .filter((c) => {
        const hay = `${c.name} ${c.address ?? ''} ${c.email ?? ''}`.toLowerCase();
        if (hay.includes(q)) return true;
        return digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits);
      })
      .sort((a, b) => {
        const an = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bn = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return an - bn || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [customers, query]);

  if (picked) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-medium">{picked.name}</p>
            {(picked.address || picked.phone) && (
              <p className="truncate text-xs text-muted-foreground">{[picked.address, picked.phone].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            aria-label="Choose a different customer"
          >
            <X className="size-4" data-icon="inline-start" />
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="customer-search" className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="customer-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, address or phone"
          className="h-11 pl-9"
          autoComplete="off"
        />
      </div>
      {query.trim() && (
        <ul className="divide-y overflow-hidden rounded-lg border bg-background" role="listbox" aria-label="Matching customers">
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">No customers match &ldquo;{query.trim()}&rdquo;.</li>
          ) : (
            matches.map((c) => (
              <li key={c.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => onChange(c.id)}
                  className="flex w-full min-h-11 flex-col items-start px-3 py-2 text-left hover:bg-muted/60"
                >
                  <span className="text-sm font-medium">{c.name}</span>
                  {(c.address || c.phone) && (
                    <span className="text-xs text-muted-foreground">{[c.address, c.phone].filter(Boolean).join(' · ')}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
