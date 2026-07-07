'use client';

import { useLocation } from '@/lib/location-context';
import { useData } from '@/lib/data-context';
import { useOrgContext } from '@/lib/org-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LocationSelector() {
  const { selectedLocationId, setSelectedLocationId } = useLocation();
  const { locations, getLocationById } = useData();
  const org = useOrgContext();
  const currentLocation = getLocationById(selectedLocationId);

  // Multi-location switching is a Professional / Enterprise feature
  const isMultiLocation = org.isEnterprise || org.locationCount > 1;

  if (!isMultiLocation) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="w-4 h-4" />
        <span>{currentLocation?.name ?? 'Location'}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors" />
        }
      >
        <MapPin className="w-4 h-4 text-muted-foreground" />
        <span>{currentLocation?.name ?? 'Select location'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Locations
        </div>
        <DropdownMenuSeparator />
        {locations.map((loc) => (
          <DropdownMenuItem
            key={loc.id}
            onClick={() => setSelectedLocationId(loc.id)}
            className={cn(
              'flex items-center justify-between gap-2',
              loc.id === selectedLocationId && 'font-medium'
            )}
          >
            <span>
              {loc.name}
              <span className="block text-xs text-muted-foreground font-normal">
                {loc.city}, {loc.state}
              </span>
            </span>
            {loc.id === selectedLocationId && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
