// RedFox CRM – type definitions and utility functions
// All data is now fetched from Supabase via the data-context and useData() hook

export type ServiceType =
  | "Holiday Lighting Installation"
  | "Roofline Lighting"
  | "Pathway Lights"
  | "Tree Wrap Lights"
  | "Icicle Lights"
  | "Custom Installation"
  | "Removal & Storage"
  | "Design Consultation";

export type JobStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";
export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue";
export type CustomerStatus = "Active" | "Inactive" | "Lead";
export type EstimateStatus = "Draft" | "Sent" | "Accepted" | "Rejected" | "Converted";
export type PlanType = "starter" | "professional" | "enterprise";

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  managerName: string;
  createdAt: string;
}

export interface Property {
  id: string;
  customerId: string;
  locationId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  squareFootage?: number;
  rooflineLinearFeet?: number;
  notes?: string;
  photos?: string[];
}

export interface CustomerPhoto {
  id: string;
  customerId: string;
  photoUrl: string;
  photoType?: string;
  description?: string;
  fileSize?: number;
  createdAt?: string;
}

export interface CustomerProperty {
  id: string;
  customerId: string;
  propertyName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  isPrimary: boolean;
  isBillingAddress: boolean;
  isServiceAddress: boolean;
  isActive: boolean;
  notes: string;
  createdAt?: string;
}

export interface Customer {
  id: string;
  locationId: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  status: CustomerStatus;
  propertyIds: string[];
  installStatus?: string;
  createdAt: string;
}

export interface Job {
  id: string;
  customerId: string;
  propertyId: string;
  locationId: string;
  title: string;
  serviceType: ServiceType;
  status: JobStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMins: number;
  technicianName: string;
  notes?: string;
  amount: number;
  estimateId?: string;
}

export interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Estimate {
  id: string;
  estimateNumber: string;
  customerId: string;
  propertyId: string;
  locationId: string;
  status: EstimateStatus;
  createdDate: string;
  validUntil: string;
  lineItems: EstimateLineItem[];
  discount?: number;
  notes?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  locationId: string;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  discount?: number;
  notes?: string;
  estimateId?: string;
}

export interface Employee {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  position?: string;
  crewName?: string;
  role: "crew_lead" | "technician" | "admin";
  isActive: boolean;
  canAccessWorkOrders: boolean;
  canAccessMapping: boolean;
  createdAt: string;
}

/**
 * Calculate total amount for an invoice from line items
 */
export function getInvoiceTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
}

/**
 * Calculate total amount for an estimate from line items, minus discount
 */
export function getEstimateTotal(estimate: Estimate): number {
  const subtotal = estimate.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  return subtotal - (estimate.discount || 0);
}
