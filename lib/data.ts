// RedFox CRM – mock data layer for holiday lighting installer
// In production this would be replaced with Supabase queries.

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

export interface Customer {
  id: string;
  locationId: string;
  name: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  propertyIds: string[];
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
  jobId?: string;
  estimateId?: string;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
}

// ─── Seed data: Locations (multi-location support) ─────────────────────────

export const locations: Location[] = [
  {
    id: "loc-1",
    name: "Austin",
    address: "1500 Barton Springs Rd",
    city: "Austin",
    state: "TX",
    zip: "78704",
    phone: "(512) 555-0001",
    managerName: "Chris Johnson",
    createdAt: "2024-01-15",
  },
  {
    id: "loc-2",
    name: "Dallas",
    address: "5656 Main Street",
    city: "Dallas",
    state: "TX",
    zip: "75201",
    phone: "(469) 555-0002",
    managerName: "Sarah Williams",
    createdAt: "2024-02-01",
  },
  {
    id: "loc-3",
    name: "Houston",
    address: "2900 Kirby Drive",
    city: "Houston",
    state: "TX",
    zip: "77098",
    phone: "(713) 555-0003",
    managerName: "Michael Chen",
    createdAt: "2024-03-10",
  },
];

// ─── Seed data: Properties ───────────────────────────────────────────────────

export const properties: Property[] = [
  {
    id: "prop-1",
    customerId: "cust-1",
    locationId: "loc-1",
    address: "1234 Dripping Springs Dr",
    city: "Austin",
    state: "TX",
    zip: "78704",
    squareFootage: 4200,
    rooflineLinearFeet: 180,
    notes: "High gabled roof, prefers warm white lights",
  },
  {
    id: "prop-2",
    customerId: "cust-1",
    locationId: "loc-1",
    address: "5678 Highland Blvd",
    city: "Austin",
    state: "TX",
    zip: "78741",
    squareFootage: 3800,
    rooflineLinearFeet: 160,
    notes: "Two-story, has existing light hooks",
  },
  {
    id: "prop-3",
    customerId: "cust-2",
    locationId: "loc-1",
    address: "99 Cedar Ridge",
    city: "Austin",
    state: "TX",
    zip: "78745",
    squareFootage: 5200,
    rooflineLinearFeet: 220,
  },
  {
    id: "prop-4",
    customerId: "cust-3",
    locationId: "loc-1",
    address: "300 Oak Hollow Ln",
    city: "Austin",
    state: "TX",
    zip: "78746",
    squareFootage: 3500,
    rooflineLinearFeet: 140,
  },
  {
    id: "prop-5",
    customerId: "cust-4",
    locationId: "loc-2",
    address: "4500 Preston Rd",
    city: "Dallas",
    state: "TX",
    zip: "75205",
    squareFootage: 4800,
    rooflineLinearFeet: 200,
    notes: "Premium neighborhood",
  },
  {
    id: "prop-6",
    customerId: "cust-5",
    locationId: "loc-2",
    address: "7890 Mockingbird Lane",
    city: "Dallas",
    state: "TX",
    zip: "75209",
    squareFootage: 5500,
    rooflineLinearFeet: 240,
  },
  {
    id: "prop-7",
    customerId: "cust-6",
    locationId: "loc-3",
    address: "2100 Westheimer Rd",
    city: "Houston",
    state: "TX",
    zip: "77098",
    squareFootage: 4400,
    rooflineLinearFeet: 190,
  },
];

// ─── Seed data: Customers ────────────────────────────────────────────────────

export const customers: Customer[] = [
  {
    id: "cust-1",
    locationId: "loc-1",
    name: "Smith Family",
    email: "smith@example.com",
    phone: "(512) 555-1111",
    status: "Active",
    propertyIds: ["prop-1", "prop-2"],
    createdAt: "2024-02-14",
  },
  {
    id: "cust-2",
    locationId: "loc-1",
    name: "ABC Property Group",
    email: "contact@abcprop.com",
    phone: "(512) 555-2222",
    status: "Active",
    propertyIds: ["prop-3"],
    createdAt: "2024-03-01",
  },
  {
    id: "cust-3",
    locationId: "loc-1",
    name: "Westlake Heights HOA",
    email: "hoa@westlake.com",
    phone: "(512) 555-3333",
    status: "Active",
    propertyIds: ["prop-4"],
    createdAt: "2024-04-18",
  },
  {
    id: "cust-4",
    locationId: "loc-2",
    name: "Johnson Residence",
    email: "johnson@example.com",
    phone: "(469) 555-4444",
    status: "Active",
    propertyIds: ["prop-5"],
    createdAt: "2024-05-10",
  },
  {
    id: "cust-5",
    locationId: "loc-2",
    name: "Premium Homes Dallas",
    email: "premium@dallashomes.com",
    phone: "(469) 555-5555",
    status: "Active",
    propertyIds: ["prop-6"],
    createdAt: "2024-06-20",
  },
  {
    id: "cust-6",
    locationId: "loc-3",
    name: "Houston Corporate",
    email: "corporate@houston.com",
    phone: "(713) 555-6666",
    status: "Lead",
    propertyIds: ["prop-7"],
    createdAt: "2024-07-01",
  },
];

// ─── Seed data: Jobs ─────────────────────────────────────────────────────────

export const jobs: Job[] = [
  {
    id: "job-1",
    customerId: "cust-1",
    propertyId: "prop-1",
    locationId: "loc-1",
    title: "Complete Holiday Lighting Installation",
    serviceType: "Holiday Lighting Installation",
    status: "Scheduled",
    scheduledDate: "2024-11-10",
    scheduledTime: "08:00",
    durationMins: 360,
    technicianName: "Derek Martinez",
    notes: "Install warm white roofline + pathway lights",
    amount: 2450,
    estimateId: "est-1",
  },
  {
    id: "job-2",
    customerId: "cust-2",
    propertyId: "prop-3",
    locationId: "loc-1",
    title: "Premium Roofline + Tree Wrap",
    serviceType: "Custom Installation",
    status: "In Progress",
    scheduledDate: "2024-11-12",
    scheduledTime: "09:00",
    durationMins: 480,
    technicianName: "Sarah Lee",
    amount: 5200,
    estimateId: "est-2",
  },
  {
    id: "job-3",
    customerId: "cust-3",
    propertyId: "prop-4",
    locationId: "loc-1",
    title: "HOA Common Area Lighting",
    serviceType: "Pathway Lights",
    status: "Completed",
    scheduledDate: "2024-10-15",
    scheduledTime: "14:00",
    durationMins: 240,
    technicianName: "James Wilson",
    amount: 1800,
  },
  {
    id: "job-4",
    customerId: "cust-4",
    propertyId: "prop-5",
    locationId: "loc-2",
    title: "Full Home Installation",
    serviceType: "Holiday Lighting Installation",
    status: "Scheduled",
    scheduledDate: "2024-11-15",
    scheduledTime: "08:30",
    durationMins: 360,
    technicianName: "Marcus Brown",
    amount: 3100,
  },
  {
    id: "job-5",
    customerId: "cust-5",
    propertyId: "prop-6",
    locationId: "loc-2",
    title: "Luxury Estate Lighting Design",
    serviceType: "Custom Installation",
    status: "Scheduled",
    scheduledDate: "2024-11-20",
    scheduledTime: "10:00",
    durationMins: 480,
    technicianName: "Priya Sharma",
    amount: 6500,
  },
  {
    id: "job-6",
    customerId: "cust-6",
    propertyId: "prop-7",
    locationId: "loc-3",
    title: "Commercial Office Festive Lighting",
    serviceType: "Holiday Lighting Installation",
    status: "Scheduled",
    scheduledDate: "2024-11-18",
    scheduledTime: "06:00",
    durationMins: 300,
    technicianName: "Antonio Garcia",
    notes: "Early morning to avoid business hours",
    amount: 2200,
  },
];

// ─── Seed data: Estimates ────────────────────────────────────────────────────

export const estimates: Estimate[] = [
  {
    id: "est-1",
    estimateNumber: "EST-2024-001",
    customerId: "cust-1",
    propertyId: "prop-1",
    locationId: "loc-1",
    status: "Accepted",
    createdDate: "2024-10-15",
    validUntil: "2024-11-15",
    lineItems: [
      {
        id: "li-1",
        description: "Holiday Lighting Installation (180 ft roofline)",
        quantity: 1,
        unitPrice: 1800,
      },
      {
        id: "li-2",
        description: "LED Pathway Lights (12 units)",
        quantity: 12,
        unitPrice: 45,
      },
      { id: "li-3", description: "Installation Labor", quantity: 1, unitPrice: 200 },
    ],
    discount: 100,
  },
  {
    id: "est-2",
    estimateNumber: "EST-2024-002",
    customerId: "cust-2",
    propertyId: "prop-3",
    locationId: "loc-1",
    status: "Sent",
    createdDate: "2024-10-20",
    validUntil: "2024-11-10",
    lineItems: [
      {
        id: "li-4",
        description: "Premium Roofline Lighting (220 ft)",
        quantity: 1,
        unitPrice: 3200,
      },
      {
        id: "li-5",
        description: "Tree Wrap Light Installation (3 trees)",
        quantity: 3,
        unitPrice: 400,
      },
      { id: "li-6", description: "Design Consultation", quantity: 2, unitPrice: 200 },
    ],
  },
  {
    id: "est-3",
    estimateNumber: "EST-2024-003",
    customerId: "cust-3",
    propertyId: "prop-4",
    locationId: "loc-1",
    status: "Converted",
    createdDate: "2024-09-20",
    validUntil: "2024-10-20",
    lineItems: [
      {
        id: "li-7",
        description: "Pathway Lighting Setup (Common Areas)",
        quantity: 1,
        unitPrice: 1500,
      },
      { id: "li-8", description: "LED Pathway Lights (20 units)", quantity: 20, unitPrice: 30 },
    ],
    discount: 0,
  },
  {
    id: "est-4",
    estimateNumber: "EST-2024-004",
    customerId: "cust-4",
    propertyId: "prop-5",
    locationId: "loc-2",
    status: "Draft",
    createdDate: "2024-11-01",
    validUntil: "2024-11-20",
    lineItems: [
      {
        id: "li-9",
        description: "Full Home Holiday Installation",
        quantity: 1,
        unitPrice: 2500,
      },
      { id: "li-10", description: "Icicle Lights (250 count)", quantity: 2, unitPrice: 300 },
    ],
  },
];

// ─── Seed data: Invoices ─────────────────────────────────────────────────────

export const invoices: Invoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV-2024-001",
    customerId: "cust-3",
    locationId: "loc-1",
    jobId: "job-3",
    estimateId: "est-3",
    status: "Paid",
    issuedDate: "2024-10-20",
    dueDate: "2024-11-03",
    lineItems: [
      {
        description: "Pathway Lighting Setup (Common Areas)",
        quantity: 1,
        unitPrice: 1500,
      },
      { description: "LED Pathway Lights (20 units)", quantity: 20, unitPrice: 30 },
    ],
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-2024-002",
    customerId: "cust-1",
    locationId: "loc-1",
    jobId: "job-1",
    estimateId: "est-1",
    status: "Sent",
    issuedDate: "2024-11-05",
    dueDate: "2024-11-19",
    lineItems: [
      {
        description: "Holiday Lighting Installation (180 ft roofline)",
        quantity: 1,
        unitPrice: 1800,
      },
      { description: "LED Pathway Lights (12 units)", quantity: 12, unitPrice: 45 },
      { description: "Installation Labor", quantity: 1, unitPrice: 200 },
    ],
  },
  {
    id: "inv-3",
    invoiceNumber: "INV-2024-003",
    customerId: "cust-2",
    locationId: "loc-1",
    status: "Draft",
    issuedDate: "2024-11-08",
    dueDate: "2024-11-22",
    lineItems: [
      {
        description: "Premium Roofline Lighting (220 ft)",
        quantity: 1,
        unitPrice: 3200,
      },
      { description: "Tree Wrap Light Installation (3 trees)", quantity: 3, unitPrice: 400 },
    ],
  },
];

// ─── Pricing Plans ───────────────────────────────────────────────────────────

export const pricingPlans: Record<PlanType, { name: string; maxLocations: number; monthlyPrice: number; features: string[] }> = {
  starter: {
    name: "Starter",
    maxLocations: 1,
    monthlyPrice: 49,
    features: [
      "1 Location",
      "Up to 100 Customers",
      "Customer Portal",
      "Basic Estimates & Invoices",
      "Mobile App",
    ],
  },
  professional: {
    name: "Professional",
    maxLocations: 5,
    monthlyPrice: 149,
    features: [
      "5 Locations",
      "Unlimited Customers",
      "Advanced Estimates & Invoices",
      "Crew Scheduling",
      "Customer Portal",
      "Mobile App",
      "Route Optimization",
    ],
  },
  enterprise: {
    name: "Enterprise",
    maxLocations: 999,
    monthlyPrice: 0,
    features: [
      "Unlimited Locations",
      "Unlimited Everything",
      "Dedicated Support",
      "Custom Integrations",
      "API Access",
      "Advanced Analytics",
      "SSO",
      "SLA Guarantee",
    ],
  },
};

// ─── Helper functions ────────────────────────────────────────────────────────

export function getCustomerById(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}

export function getPropertyById(id: string): Property | undefined {
  return properties.find((p) => p.id === id);
}

export function getLocationById(id: string): Location | undefined {
  return locations.find((l) => l.id === id);
}

export function getEstimateById(id: string): Estimate | undefined {
  return estimates.find((e) => e.id === id);
}

export function getCustomerProperties(customerId: string): Property[] {
  return properties.filter((p) => p.customerId === customerId);
}

export function getCustomerJobs(customerId: string): Job[] {
  return jobs.filter((j) => j.customerId === customerId);
}

export function getCustomerInvoices(customerId: string): Invoice[] {
  return invoices.filter((i) => i.customerId === customerId);
}

export function getLocationCustomers(locationId: string): Customer[] {
  return customers.filter((c) => c.locationId === locationId);
}

export function getLocationJobs(locationId: string): Job[] {
  return jobs.filter((j) => j.locationId === locationId);
}

export function getLocationEstimates(locationId: string): Estimate[] {
  return estimates.filter((e) => e.locationId === locationId);
}

export function getInvoiceTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
}

export function getEstimateTotal(estimate: Estimate): number {
  const subtotal = estimate.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  return subtotal - (estimate.discount || 0);
}

export function getDashboardStats(locationId: string) {
  const locationJobs = getLocationJobs(locationId);
  const locationInvoices = invoices.filter((i) => i.locationId === locationId);
  const locationCustomers = getLocationCustomers(locationId);

  const totalRevenue = locationInvoices
    .filter((i) => i.status === "Paid")
    .reduce((sum, i) => sum + getInvoiceTotal(i), 0);

  const outstandingRevenue = locationInvoices
    .filter((i) => i.status === "Sent" || i.status === "Overdue")
    .reduce((sum, i) => sum + getInvoiceTotal(i), 0);

  const scheduledJobs = locationJobs.filter((j) => j.status === "Scheduled").length;
  const completedJobs = locationJobs.filter((j) => j.status === "Completed").length;
  const activeCustomers = locationCustomers.filter((c) => c.status === "Active").length;

  return {
    totalRevenue,
    outstandingRevenue,
    activeCustomers,
    scheduledJobs,
    completedJobs,
  };
}
