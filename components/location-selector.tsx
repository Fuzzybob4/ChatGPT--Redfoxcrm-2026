'use client';

import { useLocation } from '@/lib/location-context';
import { locations, getLocationById } from '@/lib/data';
import { Select, SelectItem, SelectGroup } from '@/components/ui/select';
import { MapPin } from 'lucide-react';

export function LocationSelector() {
  const { selectedLocationId, setSelectedLocationId } = useLocation();
  const currentLocation = getLocationById(selectedLocationId);

  return (
    <div className="flex items-center gap-2">
      <MapPin className="w-4 h-4 text-muted-foreground" />
      <Select value={selectedLocationId} onValueChange={(v) => setSelectedLocationId(v || selectedLocationId)}>
        <SelectGroup>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </Select>
    </div>
  );
}
