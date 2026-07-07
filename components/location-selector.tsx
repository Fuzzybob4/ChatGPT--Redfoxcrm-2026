'use client';

import { useLocation } from '@/lib/location-context';
import { useAuth } from '@/lib/auth-context';
import { locations, getLocationById } from '@/lib/data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LocationSelector() {
  const { selectedLocationId, setSelectedLocationId } = useLocation();
  const { user } = useAuth();
  const currentLocation = getLocationById(selectedLocationId);

  // Multi-location switching is a Professional / Enterprise feature
  const isMultiLocation = user?.plan === 'professional' || user?.plan === 'enterprise';

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
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Locations
        </DropdownMenuLabel>
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
