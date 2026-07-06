// RedFox CRM – mock data layer
// In production this would be replaced with Supabase queries.

export type ServiceType =
  | "Lawn Care"
  | "Pest Control"
  | "HVAC"
  | "Cleaning"
  | "Tree Service"
  | "Pressure Washing";

export type JobStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";
export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue";
export type CustomerStatus = "Active" | "Inactive" | "Lead";

export interface Property {
  id: string;
  customerId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  serviceType: ServiceType;
  notes?: string;
}

export interface Customer {
  id: string;
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
  title: string;
  serviceType: ServiceType;
  status: JobStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMins: number;
  technicianName: string;
  notes?: string;
  amount: number;
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
  jobId?: string;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
}

// ─── Seed data ──────────────────────────────────────────────────────────────

export const properties: Property[] = [
  {
    id: "prop-1",
    customerId: "cust-1",
    address: "1234 Oak Lane",
    city: "Austin",
    state: "TX",
    zip: "78701",
    serviceType: "Lawn Care",
  },
  {
    id: "prop-2",
    customerId: "cust-1",
    address: "5678 Pine Rd",
    city: "Austin",
    state: "TX",
    zip: "78702",
    serviceType: "Pest Control",
    notes: "Has dogs – call ahead",
  },
  {
    id: "prop-3",
    customerId: "cust-2",
    address: "99 Elmwood Ct",
    city: "Round Rock",
    state: "TX",
    zip: "78664",
    serviceType: "HVAC",
  },
  {
    id: "prop-4",
    customerId: "cust-3",
    address: "300 Maple Ave",
    city: "Cedar Park",
    state: "TX",
    zip: "78613",
    serviceType: "Cleaning",
    notes: "Weekly service",
  },
  {
    id: "prop-5",
    customerId: "cust-4",
    address: "77 Birch St",
    city: "Pflugerville",
    state: "TX",
    zip: "78660",
    serviceType: "Tree Service",
  },
  {
    id: "prop-6",
    customerId: "cust-5",
    address: "451 Cedar Blvd",
    city: "Georgetown",
    state: "TX",
    zip: "78626",
    serviceType: "Pressure Washing",
  },
];

export const customers: Customer[] = [
  {
    id: "cust-1",
    name: "Sandra Martinez",
    email: "sandra@example.com",
    phone: "(512) 555-0101",
    status: "Active",
    propertyIds: ["prop-1", "prop-2"],
    createdAt: "2024-02-14",
  },
  {
    id: "cust-2",
    name: "James Okafor",
    email: "james@example.com",
    phone: "(512) 555-0202",
    status: "Active",
    propertyIds: ["prop-3"],
    createdAt: "2024-03-01",
  },
  {
    id: "cust-3",
    name: "Emily Chen",
    email: "emily@example.com",
    phone: "(512) 555-0303",
    status: "Active",
    propertyIds: ["prop-4"],
    createdAt: "2024-04-18",
  },
  {
    id: "cust-4",
    name: "Robert Thompson",
    email: "robert@example.com",
    phone: "(512) 555-0404",
    status: "Inactive",
    propertyIds: ["prop-5"],
    createdAt: "2023-11-05",
  },
  {
    id: "cust-5",
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "(512) 555-0505",
    status: "Lead",
    propertyIds: ["prop-6"],
    createdAt: "2024-06-20",
  },
  {
    id: "cust-6",
    name: "Marcus Bell",
    email: "marcus@example.com",
    phone: "(512) 555-0606",
    status: "Active",
    propertyIds: [],
    createdAt: "2024-07-01",
  },
];

export const jobs: Job[] = [
  {
    id: "job-1",
    customerId: "cust-1",
    propertyId: "prop-1",
    title: "Monthly Lawn Mow + Edge",
    serviceType: "Lawn Care",
    status: "Scheduled",
    scheduledDate: "2026-07-08",
    scheduledTime: "09:00",
    durationMins: 60,
    technicianName: "Diego Reyes",
    amount: 85,
  },
  {
    id: "job-2",
    customerId: "cust-2",
    propertyId: "prop-3",
    title: "AC Summer Tune-Up",
    serviceType: "HVAC",
    status: "In Progress",
    scheduledDate: "2026-07-06",
    scheduledTime: "14:00",
    durationMins: 90,
    technicianName: "Kyle Davis",
    amount: 175,
  },
  {
    id: "job-3",
    customerId: "cust-3",
    propertyId: "prop-4",
    title: "Weekly Deep Clean",
    serviceType: "Cleaning",
    status: "Completed",
    scheduledDate: "2026-07-04",
    scheduledTime: "10:00",
    durationMins: 120,
    technicianName: "Maria Lopez",
    amount: 140,
  },
  {
    id: "job-4",
    customerId: "cust-1",
    propertyId: "prop-2",
    title: "Quarterly Pest Treatment",
    serviceType: "Pest Control",
    status: "Scheduled",
    scheduledDate: "2026-07-10",
    scheduledTime: "11:30",
    durationMins: 45,
    technicianName: "Diego Reyes",
    notes: "Gate code: 4821",
    amount: 95,
  },
  {
    id: "job-5",
    customerId: "cust-4",
    propertyId: "prop-5",
    title: "Oak Tree Trimming",
    serviceType: "Tree Service",
    status: "Cancelled",
    scheduledDate: "2026-07-05",
    scheduledTime: "08:00",
    durationMins: 180,
    technicianName: "Sam Park",
    amount: 320,
  },
  {
    id: "job-6",
    customerId: "cust-5",
    propertyId: "prop-6",
    title: "Driveway + Patio Wash",
    serviceType: "Pressure Washing",
    status: "Scheduled",
    scheduledDate: "2026-07-12",
    scheduledTime: "08:30",
    durationMins: 90,
    technicianName: "Tasha Brown",
    amount: 225,
  },
  {
    id: "job-7",
    customerId: "cust-3",
    propertyId: "prop-4",
    title: "Weekly Deep Clean",
    serviceType: "Cleaning",
    status: "Scheduled",
    scheduledDate: "2026-07-11",
    scheduledTime: "10:00",
    durationMins: 120,
    technicianName: "Maria Lopez",
    amount: 140,
  },
  {
    id: "job-8",
    customerId: "cust-2",
    propertyId: "prop-3",
    title: "Filter Replacement",
    serviceType: "HVAC",
    status: "Completed",
    scheduledDate: "2026-07-01",
    scheduledTime: "13:00",
    durationMins: 30,
    technicianName: "Kyle Davis",
    amount: 60,
  },
];

export const invoices: Invoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV-2026-001",
    customerId: "cust-3",
    jobId: "job-3",
    status: "Paid",
    issuedDate: "2026-07-04",
    dueDate: "2026-07-18",
    lineItems: [
      { description: "Weekly Deep Clean", quantity: 1, unitPrice: 140 },
    ],
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-2026-002",
    customerId: "cust-2",
    jobId: "job-8",
    status: "Paid",
    issuedDate: "2026-07-01",
    dueDate: "2026-07-15",
    lineItems: [
      { description: "Filter Replacement", quantity: 1, unitPrice: 45 },
      { description: "Labor (30 min)", quantity: 1, unitPrice: 15 },
    ],
  },
  {
    id: "inv-3",
    invoiceNumber: "INV-2026-003",
    customerId: "cust-2",
    jobId: "job-2",
    status: "Sent",
    issuedDate: "2026-07-06",
    dueDate: "2026-07-20",
    lineItems: [
      { description: "AC Summer Tune-Up", quantity: 1, unitPrice: 150 },
      { description: "Refrigerant Top-Off", quantity: 1, unitPrice: 25 },
    ],
  },
  {
    id: "inv-4",
    invoiceNumber: "INV-2026-004",
    customerId: "cust-1",
    jobId: "job-1",
    status: "Draft",
    issuedDate: "2026-07-08",
    dueDate: "2026-07-22",
    lineItems: [
      { description: "Monthly Lawn Mow + Edge", quantity: 1, unitPrice: 75 },
      { description: "Fertilizer Treatment", quantity: 1, unitPrice: 10 },
    ],
  },
  {
    id: "inv-5",
    invoiceNumber: "INV-2026-005",
    customerId: "cust-5",
    jobId: "job-6",
    status: "Sent",
    issuedDate: "2026-07-06",
    dueDate: "2026-07-13",
    lineItems: [
      { description: "Driveway Wash", quantity: 1, unitPrice: 125 },
      { description: "Patio Wash", quantity: 1, unitPrice: 100 },
    ],
  },
  {
    id: "inv-6",
    invoiceNumber: "INV-2025-089",
    customerId: "cust-4",
    status: "Overdue",
    issuedDate: "2026-05-15",
    dueDate: "2026-05-29",
    lineItems: [
      { description: "Tree Removal Deposit (50%)", quantity: 1, unitPrice: 200 },
    ],
  },
];

// ─── Helper functions ────────────────────────────────────────────────────────

export function getCustomerById(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}

export function getPropertyById(id: string): Property | undefined {
  return properties.find((p) => p.id === id);
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

export function getInvoiceTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
}

export function getDashboardStats() {
  const totalRevenue = invoices
    .filter((i) => i.status === "Paid")
    .reduce((sum, i) => sum + getInvoiceTotal(i), 0);

  const outstandingRevenue = invoices
    .filter((i) => i.status === "Sent" || i.status === "Overdue")
    .reduce((sum, i) => sum + getInvoiceTotal(i), 0);

  const activeCustomers = customers.filter((c) => c.status === "Active").length;
  const scheduledJobs = jobs.filter((j) => j.status === "Scheduled").length;
  const completedJobs = jobs.filter((j) => j.status === "Completed").length;

  return {
    totalRevenue,
    outstandingRevenue,
    activeCustomers,
    scheduledJobs,
    completedJobs,
  };
}
