'use client';

import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  mapCustomer,
  mapLocation,
  mapInvoice,
  mapEstimate,
  mapJob,
} from '@/lib/db/mappers';
import type { Customer, Invoice, Estimate, Location, Job, CustomerPhoto, PropertyPhoto, CustomerProperty } from '@/lib/data';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  crewName: string;
  isActive: boolean;
  canAccessWorkOrders: boolean;
  canAccessMapping: boolean;
  locationId: string | null;
}

export interface Addon {
  id: string;
  code: string;
  name: string;
  description: string;
  priceCents: number;
  billingUnit: string;
}

export interface OrgInfo {
  id: string;
  name: string;
  paymentProvider: string | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
}

type LiveCustomer = ReturnType<typeof mapCustomer>;
type LiveInvoice = ReturnType<typeof mapInvoice>;
type LiveEstimate = ReturnType<typeof mapEstimate>;

interface DataContextType {
  loading: boolean;
  org: OrgInfo | null;
  customers: LiveCustomer[];
  locations: Location[];
  invoices: LiveInvoice[];
  estimates: LiveEstimate[];
  jobs: Job[];
  employees: Employee[];
  addons: Addon[];
  photos: CustomerPhoto[];
  propertyPhotos: PropertyPhoto[];
  properties: CustomerProperty[];
  refresh: () => Promise<void>;
  // helper API (mirrors the former mock lib/data.ts)
  getCustomerById: (id: string) => LiveCustomer | undefined;
  getLocationById: (id: string) => Location | undefined;
  getEstimateById: (id: string) => LiveEstimate | undefined;
  getCustomerInvoices: (customerId: string) => LiveInvoice[];
  getCustomerJobs: (customerId: string) => Job[];
  getCustomerPhotos: (customerId: string) => CustomerPhoto[];
  getPropertyPhotos: (propertyId: string) => PropertyPhoto[];
  getCustomerProperties: (customerId: string) => CustomerProperty[];
  getLocationCustomers: (locationId: string) => LiveCustomer[];
  getLocationJobs: (locationId: string) => Job[];
  getLocationEstimates: (locationId: string) => LiveEstimate[];
  getDashboardStats: (locationId: string) => {
    totalRevenue: number;
    outstandingRevenue: number;
    activeCustomers: number;
    scheduledJobs: number;
    completedJobs: number;
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [invoices, setInvoices] = useState<LiveInvoice[]>([]);
  const [estimates, setEstimates] = useState<LiveEstimate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [photos, setPhotos] = useState<CustomerPhoto[]>([]);
  const [propertyPhotos, setPropertyPhotos] = useState<PropertyPhoto[]>([]);
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('redfox_selected_location');
    if (saved) setSelectedLocationId(saved);

    const handleLocationChange = (event: Event) => {
      const detail = (event as CustomEvent<{ locationId?: string }>).detail;
      setSelectedLocationId(detail?.locationId ?? '');
    };
    window.addEventListener('redfox-location-change', handleLocationChange);
    return () => window.removeEventListener('redfox-location-change', handleLocationChange);
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Resolve org via membership
    const { data: membership } = await supabase
      .from('user_memberships')
      .select('org_id, organizations(id, name, payment_provider, stripe_account_id, stripe_charges_enabled)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    const orgRel = membership?.organizations as any;
    const orgObj = Array.isArray(orgRel) ? orgRel[0] : orgRel;
    if (orgObj) {
      setOrg({
        id: orgObj.id,
        name: orgObj.name,
        paymentProvider: orgObj.payment_provider,
        stripeAccountId: orgObj.stripe_account_id,
        stripeChargesEnabled: !!orgObj.stripe_charges_enabled,
      });
    }

    // All queries are RLS-scoped to the caller's org automatically.
    const [
      { data: custRows, error: custError },
      { data: locRows },
      { data: invRows },
      { data: invLineItemRows },
      { data: estRows },
      { data: jobRows },
      { data: empRows },
      { data: addonRows },
      { data: photoRows, error: photoError },
      { data: propertyPhotoRows, error: propertyPhotoError },
      { data: propertyRows },
    ] = await Promise.all([
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('locations').select('*').order('created_at', { ascending: true }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('invoice_line_items').select('*').order('order', { ascending: true }),
      supabase.from('estimates').select('*').order('created_at', { ascending: false }),
      supabase.from('scheduled_jobs').select('*').order('scheduled_date', { ascending: true }),
      supabase.from('employees').select('*').order('created_at', { ascending: true }),
      supabase.from('addon_catalog').select('*').order('price_cents', { ascending: true }),
      supabase.from('customer_photos').select('*').order('created_at', { ascending: false }),
      supabase.from('property_photos').select('*').order('created_at', { ascending: false }),
      supabase.from('customer_properties').select('*').order('created_at', { ascending: true }),
    ]);

    if (custError) console.error('[v0] Failed to load customers:', custError);
    if (photoError) console.error('[v0] Failed to load customer photos:', photoError);
    if (propertyPhotoError) console.error('[v0] Failed to load property photos:', propertyPhotoError);

    setCustomers((custRows ?? []).map(mapCustomer));
    setLocations((locRows ?? []).map(mapLocation));
    setInvoices((invRows ?? []).map((inv) => mapInvoice(inv, invLineItemRows ?? [])));
    setEstimates((estRows ?? []).map(mapEstimate));
    setJobs((jobRows ?? []).map(mapJob));
    setEmployees(
      (empRows ?? []).map((r: Record<string, any>) => ({
        id: r.id,
        firstName: r.first_name ?? '',
        lastName: r.last_name ?? '',
        fullName: r.full_name?.trim() || `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
        email: r.email ?? '',
        phone: r.phone ?? '',
        role: r.role ?? r.position ?? '',
        crewName: r.crew_name ?? '',
        isActive: r.is_active ?? true,
        canAccessWorkOrders: r.can_access_work_orders ?? false,
        canAccessMapping: r.can_access_mapping ?? false,
        locationId: r.location_id ?? null,
      })),
    );
    setAddons(
      (addonRows ?? []).map((r: Record<string, any>) => ({
        id: r.id,
        code: r.code ?? '',
        name: r.name ?? '',
        description: r.description ?? '',
        priceCents: r.price_cents ?? 0,
        billingUnit: r.billing_unit ?? 'month',
      })),
    );
    setPhotos(
      (photoRows ?? []).map((r: Record<string, any>) => ({
        id: r.id,
        customerId: r.customer_id,
        photoUrl: r.photo_url,
        photoType: r.photo_type,
        description: r.description,
        fileSize: r.file_size,
        createdAt: r.created_at,
      })),
    );
    setPropertyPhotos(
      (propertyPhotoRows ?? []).map((r: Record<string, any>) => ({
        id: r.id,
        propertyId: r.property_id,
        customerId: r.customer_id,
        photoUrl: r.photo_url,
        photoType: r.photo_type,
        description: r.description,
        fileSize: r.file_size,
        createdAt: r.created_at,
      })),
    );
    setProperties(
      (propertyRows ?? []).map((r: Record<string, any>) => ({
        id: r.id,
        customerId: r.customer_id,
        propertyName: r.property_name ?? '',
        address: r.address ?? '',
        city: r.city ?? '',
        state: r.state ?? '',
        zip: r.zip_code ?? '',
        propertyType: r.property_type ?? '',
        isPrimary: !!r.is_primary,
        isBillingAddress: !!r.is_billing_address,
        isServiceAddress: !!r.is_service_address,
        isActive: r.is_active ?? true,
        notes: r.notes ?? '',
        lat: r.lat,
        lng: r.lng,
        createdAt: r.created_at,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visibleCustomerIds = useMemo(
    () => new Set((selectedLocationId ? customers.filter((c) => c.locationId === selectedLocationId) : customers).map((c) => c.id)),
    [customers, selectedLocationId],
  );
  const visibleCustomers = useMemo(
    () => selectedLocationId ? customers.filter((c) => c.locationId === selectedLocationId) : customers,
    [customers, selectedLocationId],
  );
  const visibleInvoices = useMemo(
    () => selectedLocationId ? invoices.filter((i) => i.locationId === selectedLocationId) : invoices,
    [invoices, selectedLocationId],
  );
  const visibleEstimates = useMemo(
    () => selectedLocationId ? estimates.filter((e) => e.locationId === selectedLocationId) : estimates,
    [estimates, selectedLocationId],
  );
  const visibleJobs = useMemo(
    () => selectedLocationId ? jobs.filter((j) => j.locationId === selectedLocationId) : jobs,
    [jobs, selectedLocationId],
  );
  const visibleEmployees = useMemo(
    () => selectedLocationId ? employees.filter((e) => e.locationId === selectedLocationId) : employees,
    [employees, selectedLocationId],
  );
  const visibleProperties = useMemo(
    () => selectedLocationId ? properties.filter((p) => visibleCustomerIds.has(p.customerId)) : properties,
    [properties, selectedLocationId, visibleCustomerIds],
  );
  const visiblePhotos = useMemo(
    () => selectedLocationId ? photos.filter((p) => visibleCustomerIds.has(p.customerId)) : photos,
    [photos, selectedLocationId, visibleCustomerIds],
  );
  const visiblePropertyPhotos = useMemo(
    () => selectedLocationId ? propertyPhotos.filter((p) => visibleCustomerIds.has(p.customerId)) : propertyPhotos,
    [propertyPhotos, selectedLocationId, visibleCustomerIds],
  );

  const getCustomerById = (id: string) => visibleCustomers.find((c) => c.id === id);
  const getLocationById = (id: string) => locations.find((l) => l.id === id);
  const getEstimateById = (id: string) => visibleEstimates.find((e) => e.id === id);
  const getCustomerInvoices = (customerId: string) =>
    visibleInvoices.filter((i) => i.customerId === customerId);
  const getCustomerJobs = (customerId: string) => visibleJobs.filter((j) => j.customerId === customerId);
  const getCustomerPhotos = (customerId: string) => visiblePhotos.filter((p) => p.customerId === customerId);
  const getPropertyPhotos = (propertyId: string) =>
    visiblePropertyPhotos.filter((p) => p.propertyId === propertyId);
  const getCustomerProperties = (customerId: string) =>
    visibleProperties.filter((p) => p.customerId === customerId);
  const getLocationCustomers = (locationId: string) =>
    locationId ? customers.filter((c) => c.locationId === locationId) : customers;
  const getLocationJobs = (locationId: string) =>
    locationId ? jobs.filter((j) => j.locationId === locationId) : jobs;
  const getLocationEstimates = (locationId: string) =>
    locationId ? estimates.filter((e) => e.locationId === locationId) : estimates;

  const getDashboardStats = (locationId: string) => {
    const locInvoices = locationId
      ? invoices.filter((i) => i.locationId === locationId)
      : invoices;
    const locJobs = getLocationJobs(locationId);
    const locCustomers = getLocationCustomers(locationId);

    const totalRevenue = locInvoices
      .filter((i) => i.status === 'Paid')
      .reduce((sum, i) => sum + i.total, 0);
    const outstandingRevenue = locInvoices
      .filter((i) => i.status === 'Sent' || i.status === 'Overdue')
      .reduce((sum, i) => sum + i.total, 0);
    const scheduledJobs = locJobs.filter((j) => j.status === 'Scheduled').length;
    const completedJobs = locJobs.filter((j) => j.status === 'Completed').length;
    const activeCustomers = locCustomers.filter((c) => c.status === 'Active').length;

    return { totalRevenue, outstandingRevenue, activeCustomers, scheduledJobs, completedJobs };
  };

  return (
    <DataContext.Provider
      value={{
        loading,
        org,
        customers: visibleCustomers,
        locations,
        invoices: visibleInvoices,
        estimates: visibleEstimates,
        jobs: visibleJobs,
        employees: visibleEmployees,
        addons,
        photos: visiblePhotos,
        propertyPhotos: visiblePropertyPhotos,
        properties: visibleProperties,
        refresh,
        getCustomerById,
        getLocationById,
        getEstimateById,
        getCustomerInvoices,
        getCustomerJobs,
        getCustomerPhotos,
        getPropertyPhotos,
        getCustomerProperties,
        getLocationCustomers,
        getLocationJobs,
        getLocationEstimates,
        getDashboardStats,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (ctx === undefined) throw new Error('useData must be used within DataProvider');
  return ctx;
}
