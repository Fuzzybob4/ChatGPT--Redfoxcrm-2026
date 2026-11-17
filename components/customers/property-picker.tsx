'use client';

import { Home, Building2 } from 'lucide-react';
import { useData } from '@/lib/data-context';

export function formatPropertyAddress(p: { address?: string; city?: string; state?: string; zip?: string }) {
  return [p.address, p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/**
 * Which of the customer's properties this estimate/invoice is for. With no
 * extra properties it just shows the customer's address (nothing to pick).
 * `value` is a property id, or '' for the customer's main address.
 */
export function PropertyPicker({
  customerId,
  value,
  onChange,
  disabled = false,
}: {
  customerId: string;
  value: string;
  onChange: (propertyId: string) => void;
  disabled?: boolean;
}) {
  const { customers, properties } = useData();
  if (!customerId) return null;
  const customer = customers.find((c) => c.id === customerId);
  const props = properties.filter((p) => p.customerId === customerId && p.isActive !== false);

  if (props.length === 0) {
    return customer?.address ? (
      <p className="text-sm text-muted-foreground">
        Property: <span className="text-foreground">{customer.address}</span>
      </p>
    ) : null;
  }

  // The customer's own address counts as a choice only if no property already covers it.
  const mainAddress = (customer?.address ?? '').trim();
  const mainIsAProperty = props.some((p) => p.address.trim().toLowerCase() === mainAddress.toLowerCase());
  const options = [
    ...(mainAddress && !mainIsAProperty ? [{ id: '', name: 'Main address', address: mainAddress, icon: Home }] : []),
    ...props.map((p) => ({
      id: p.id,
      name: p.propertyName || (p.isPrimary ? 'Primary property' : 'Property'),
      address: formatPropertyAddress(p),
      icon: Building2,
    })),
  ];

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-foreground">Which property?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <label
              key={o.id || 'main'}
              className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                on ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <input
                type="radio"
                name={`property-${customerId}`}
                className="mt-1 accent-[var(--primary)]"
                checked={on}
                onChange={() => onChange(o.id)}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium">
                  <o.icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {o.name}
                </span>
                <span className="block text-xs text-muted-foreground">{o.address}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Default pick: the primary service property, else the main address. */
export function defaultPropertyId(
  properties: { id: string; customerId: string; isPrimary: boolean; isServiceAddress: boolean; isActive?: boolean }[],
  customerId: string,
): string {
  const mine = properties.filter((p) => p.customerId === customerId && p.isActive !== false);
  return (mine.find((p) => p.isPrimary) ?? (mine.length === 1 ? mine[0] : undefined))?.id ?? '';
}
