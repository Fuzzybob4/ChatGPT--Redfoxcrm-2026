'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { useData } from './data-context';

interface LocationContextType {
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { locations } = useData();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Initialize with the user's saved location, their assigned location, or "all".
  useEffect(() => {
    if (selectedLocationId) return;
    const saved =
      typeof window !== 'undefined'
        ? localStorage.getItem('redfox_selected_location')
        : null;
    if (saved) {
      setSelectedLocationId(saved);
      return;
    }
    if (user?.locationId) {
      setSelectedLocationId(user.locationId);
    } else if (locations.length > 0) {
      // Empty string means "All locations" — default to that for multi-location orgs.
      setSelectedLocationId('');
    }
  }, [user, locations, selectedLocationId]);

  const handleSetLocation = (id: string) => {
    setSelectedLocationId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('redfox_selected_location', id);
    }
  };

  return (
    <LocationContext.Provider value={{ selectedLocationId, setSelectedLocationId: handleSetLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
}
