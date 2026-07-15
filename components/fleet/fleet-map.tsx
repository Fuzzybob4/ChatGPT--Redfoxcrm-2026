'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Employee {
  employee_id: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  speed_mps: number | null;
  heading_degrees: number | null;
  last_update: string;
  work_order: {
    id: string;
    title: string;
    status: string;
    customer: string;
    address: string;
  } | null;
  vehicle_id?: string;
}

interface FleetMapProps {
  employees: Employee[];
  selectedEmployee: Employee | null;
  onSelectEmployee: (employee: Employee) => void;
}

export function FleetMap({
  employees,
  selectedEmployee,
  onSelectEmployee,
}: FleetMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const linesRef = useRef<mapboxgl.Popup[]>([]);

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Get token from window env
    const token = (window as any).NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('[fleet-map] Mapbox token not available');
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-96.8, 32.8], // Default: Dallas area
      zoom: 11,
    });

    return () => {
      // Cleanup on unmount
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers when employees change
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Add new markers
    for (const emp of employees) {
      const isSelected = selectedEmployee?.employee_id === emp.employee_id;
      const statusColor =
        emp.work_order?.status === 'in_progress'
          ? '#10b981' // green - working
          : emp.speed_mps && emp.speed_mps > 2
            ? '#3b82f6' // blue - driving
            : emp.speed_mps && emp.speed_mps < 2
              ? '#f59e0b' // orange - idle
              : '#9ca3af'; // gray - offline

      const el = document.createElement('div');
      el.className = 'cursor-pointer transition-transform hover:scale-110';
      el.innerHTML = `
        <div class="w-10 h-10 rounded-full border-2 flex items-center justify-center" style="background-color: ${statusColor}; border-color: ${isSelected ? '#000' : '#fff'}; border-width: ${isSelected ? '3px' : '2px'}">
          <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
      `;

      el.addEventListener('click', () => onSelectEmployee(emp));

      const marker = new mapboxgl.Marker(el)
        .setLngLat([emp.longitude, emp.latitude])
        .addTo(map.current!);

      // Add popup on hover
      const popupContent = `
        <div class="text-sm font-semibold">${emp.name}</div>
        <div class="text-xs text-gray-600">${emp.work_order?.customer || 'No job'}</div>
        ${emp.speed_mps ? `<div class="text-xs">Speed: ${(emp.speed_mps * 3.6).toFixed(1)} km/h</div>` : ''}
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent);
      marker.setPopup(popup);

      markersRef.current.set(emp.employee_id, marker);
    }

    // Fit bounds if employees exist
    if (employees.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const emp of employees) {
        bounds.extend([emp.longitude, emp.latitude]);
      }
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [employees, selectedEmployee, onSelectEmployee]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
