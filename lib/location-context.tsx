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

  // Initialize with the user's saved location or default to "all" (empty string).
  // Empty string means show all locations.
  useEffect(() => {
    if (selectedLocationId !== '') return; // already initialized
    
    const saved =
      typeof window !== 'undefined'
        ? localStorage.getItem('redfox_selected_location')
        : null;
    
    if (saved) {
      setSelectedLocationId(saved);
    } else {
      // Default to empty string (all locations)
      setSelectedLocationId('');
    }
  }, [selectedLocationId]);

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
