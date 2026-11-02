// Maps live Supabase rows to the app's existing entity types (lib/data.ts).
// The DB carries dual column conventions in places; these helpers normalize
// everything to the shapes the UI already consumes.

import { toDateKey } from '@/lib/dates';
import type {
  Customer,
  Invoice,
  Estimate,
  Location,
  Job,
  CustomerStatus,
  InvoiceStatus,
  EstimateStatus,
  JobStatus,
  JobType,
  ServiceType,
} from '@/lib/data';

const titleCase = (s: string | null | undefined) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** invoices/estimates carry both numeric dollars and *_cents; prefer dollars, fall back to cents/100 */
function money(dollars: unknown, cents: unknown): number {
  const d = toNum(dollars);
  if (d) return d;
  const c = toNum(cents);
  return c ? c / 100 : 0;
}

export function mapCustomer(row: Record<string, any>): Customer & {
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  installStatus: string | null;
  tags: string[];
  notes: string;
  isPropertyManager: boolean;
  propertyManagerCompany: string;
} {
  const name =
    row.full_name?.trim() ||
    `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() ||
    'Unnamed Customer';

  const statusRaw = (row.status as string) || 'active';
  const status = (titleCase(statusRaw) as CustomerStatus) || 'Active';

  return {
    id: row.id,
    locationId: row.location_id ?? '',
    name,
    email: row.email ?? row.billing_email ?? '',
    phone: row.phone ?? '',
    status,
    propertyIds: [],
    createdAt: row.created_at ?? '',
    // extra normalized fields used by mapping / detail views
    address: row.address ?? row.address1 ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    zip: row.zip_code ?? row.postal ?? '',
    lat: row.latitude ?? row.lat ?? null,
    lng: row.longitude ?? row.lng ?? null,
    installStatus: row.install_status ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    notes: row.notes ?? '',
    isPropertyManager: !!row.is_property_manager,
    propertyManagerCompany: row.property_manager_company ?? '',
  };
}

export function mapLocation(row: Record<string, any>): Location {
  return {
    id: row.id,
    name: row.name ?? '',
    address: '',
    city: row.city ?? '',
    state: row.state ?? '',
    zip: '',
    phone: row.twilio_phone_number ?? '',
    managerName: row.manager_name ?? '',
    createdAt: row.created_at ?? '',
  };
}

export function mapInvoice(row: Record<string, any>, lineItemRows: Record<string, any>[] = []): Invoice & {
  title: string;
  total: number;
  amountPaid: number;
  customerId: string;
  paymentState: string | null;
  stripePaymentLink: string | null;
} {
  const total = money(row.total_amount, row.total_cents);
  const status = (titleCase(row.status) as InvoiceStatus) || 'Draft';

  // Fetch line items for this invoice from the provided rows
  const invoiceLineItems = lineItemRows
    .filter((li) => li.invoice_id === row.id)
    .sort((a, b) => (a.sort_order ?? a.order ?? 0) - (b.sort_order ?? b.order ?? 0))
    .map((li) => ({
      description: li.description ?? 'Services',
      quantity: li.quantity ?? 1,
      unitPrice: money(li.unit_price, li.unit_price_cents),
    }));

  // If no line items found, create a default one with the total
  const lineItems = invoiceLineItems.length > 0 
    ? invoiceLineItems 
    : [
        {
          description: row.title || row.description || 'Services',
          quantity: 1,
          unitPrice: total,
        },
      ];

  return {
    id: row.id,
    invoiceNumber: row.invoice_number ?? '',
    title: row.title ?? '',
    customerId: row.customer_id ?? '',
    locationId: row.location_id ?? '',
    estimateId: undefined,
    status,
    issuedDate: toDateKey(row.issued_date) || toDateKey(row.created_at),
    dueDate: toDateKey(row.due_date),
    lineItems,
    notes: row.notes ?? undefined,
    // extra normalized fields
    total,
    amountPaid: money(row.amount_paid, row.amount_paid_cents),
    paymentState: row.payment_state ?? row.status ?? null,
    stripePaymentLink: row.stripe_payment_link ?? null,
  };
}

export function mapEstimate(
  row: Record<string, any>,
  lineItemRows: Record<string, any>[] = [],
): Estimate & { total: number } {
  const total = toNum(row.total_amount) || toNum(row.subtotal);
  const status = (titleCase(row.status) as EstimateStatus) || 'Draft';

  // Real line items (estimate_line_items, written by createEstimate). Older
  // estimates have none and keep the single synthetic line below.
  const realLineItems = lineItemRows
    .filter((li) => li.estimate_id === row.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((li) => ({
      id: li.id,
      description: li.description ?? 'Item',
      quantity: toNum(li.quantity) || 1,
      unitPrice: money(li.unit_price, li.unit_price_cents),
    }));
  const hasRealLineItems = realLineItems.length > 0;

  return {
    id: row.id,
    estimateNumber: row.estimate_number ?? '',
    customerId: row.customer_id ?? '',
    propertyId: '',
    locationId: row.location_id ?? '',
    status,
    createdDate: toDateKey(row.created_at),
    validUntil: toDateKey(row.valid_until),
    lineItems: hasRealLineItems
      ? realLineItems
      : [
          {
            id: `${row.id}-li`,
            description: row.title || row.description || 'Estimate',
            quantity: 1,
            unitPrice: toNum(row.subtotal) || total,
          },
        ],
    // Only applied with real line items so legacy estimates' totals are unchanged.
    discount: hasRealLineItems ? money(row.discount_amount, row.discount_amount_cents) : 0,
    taxAmount: hasRealLineItems ? money(row.tax_amount, row.tax_amount_cents) : 0,
    notes: row.notes ?? undefined,
    total,
  };
}

export function mapJob(row: Record<string, any>): Job {
  // Normalise status: DB stores lowercase, UI uses Title Case + "En Route"
  const rawStatus = (row.status ?? row.status_key ?? 'scheduled').toLowerCase();
  let status: JobStatus = 'Scheduled';
  if (rawStatus === 'en_route' || rawStatus === 'en route') status = 'En Route';
  else if (rawStatus === 'in_progress' || rawStatus === 'in progress') status = 'In Progress';
  else if (rawStatus === 'completed') status = 'Completed';
  else if (rawStatus === 'cancelled') status = 'Cancelled';

  // Normalise job_type
  const rawType = (row.job_type ?? 'install').toLowerCase();
  let jobType: JobType = 'install';
  if (rawType.includes('remov') || rawType.includes('takedown')) jobType = 'removal';
  else if (!rawType.includes('install')) jobType = 'other';

  return {
    id: row.id,
    customerId: row.customer_id ?? '',
    propertyId: row.property_id ?? '',
    locationId: row.location_id ?? '',
    invoiceId: row.invoice_id ?? '',
    title: row.title ?? 'Work Order',
    serviceType: (row.job_type as ServiceType) || 'Custom Installation',
    jobType,
    status,
    // Keep only the calendar day so a timestamp-typed column can't shift keys.
    scheduledDate: String(row.scheduled_date ?? '').slice(0, 10),
    scheduledTime: (row.start_time ?? '').slice(0, 5),
    durationMins: row.duration_minutes ?? 0,
    technicianName: row.crew_name ?? '',
    assignedEmployees: Array.isArray(row.assigned_employees) ? row.assigned_employees : [],
    address: row.address ?? '',
    city: row.city ?? '',
    notes: row.notes ?? undefined,
    internalNotes: row.internal_notes ?? undefined,
    amount: 0,
    estimateId: row.estimate_id ?? undefined,
    enRouteAt: row.en_route_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    seasonYear: row.season_year ?? undefined,
  };
}
