'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import { useData } from './data-context';

interface LocationContextType {
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

function readLocationCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )redfox_selected_location=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { locations } = useData();
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [initialized, setInitialized] = useState(false);

  // Initialize with the user's saved location or default to "all" (empty string).
  // Empty string means show all locations. Also reconcile the cookie that
  // Server Components (e.g. the mapping page) rely on at request time --
  // if it's out of sync with localStorage, force a refresh so the server
  // re-fetches with the correct filter.
  useEffect(() => {
    if (initialized) return;

    const saved =
      typeof window !== 'undefined'
        ? localStorage.getItem('redfox_selected_location')
        : null;
    const cookieValue = readLocationCookie();
    const resolved = saved ?? '';

    setSelectedLocationId(resolved);
    setInitialized(true);

    if (typeof window !== 'undefined' && cookieValue !== resolved) {
      document.cookie = `redfox_selected_location=${encodeURIComponent(resolved)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [initialized, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('redfox-location-change', { detail: { locationId: selectedLocationId } }));
    }
  }, [selectedLocationId]);

  useEffect(() => {
    if (!selectedLocationId || locations.length === 0) return;
    if (!locations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId('');
      localStorage.removeItem('redfox_selected_location');
      document.cookie = `redfox_selected_location=; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [locations, selectedLocationId, router]);

  const handleSetLocation = (id: string) => {
    setSelectedLocationId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('redfox_selected_location', id);
      document.cookie = `redfox_selected_location=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
      window.dispatchEvent(new CustomEvent('redfox-location-change', { detail: { locationId: id } }));
    }
    // Server Components (e.g. the mapping page) read the selected-location
    // cookie at request time, so a plain cookie/localStorage update alone
    // doesn't re-fetch their data. Force a server re-render.
    router.refresh();
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
