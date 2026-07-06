'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { locations } from './data';

interface LocationContextType {
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Initialize with user's location or first location
  useEffect(() => {
    if (user && !selectedLocationId) {
      const defaultLocation = user.locationId || locations[0]?.id || '';
      setSelectedLocationId(defaultLocation);
      localStorage.setItem('redfox_selected_location', defaultLocation);
    }
  }, [user, selectedLocationId]);

  const handleSetLocation = (id: string) => {
    setSelectedLocationId(id);
    localStorage.setItem('redfox_selected_location', id);
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
