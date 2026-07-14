// Single source of truth for all RedFox CRM subscription and add-on pricing.
// Prices are stored in cents to avoid floating-point rounding issues.

export type PlanId = "starter" | "professional" | "enterprise";
export type BillingInterval = "monthly" | "yearly";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Monthly price in cents. */
  monthlyCents: number;
  description: string;
  /** Marketing emails included per calendar month. */
  emailsPerMonth: number;
  /** Overage rate in cents per email above the monthly allowance. */
  emailOverageCentsPerEmail: number;
}

// Base subscription plans — matches the public landing/pricing page.
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyCents: 2900,
    description: "Perfect for solo operators and small teams",
    emailsPerMonth: 2000,
    emailOverageCentsPerEmail: 1.5, // $0.015
  },
  professional: {
    id: "professional",
    name: "Professional",
    monthlyCents: 7900,
    description: "For growing businesses with multiple crews",
    emailsPerMonth: 4000,
    emailOverageCentsPerEmail: 1.2, // $0.012
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyCents: 14900,
    description: "For large organizations needing custom solutions",
    emailsPerMonth: 6000,
    emailOverageCentsPerEmail: 1.0, // $0.010
  },
};

// Yearly billing gives 20% off the BASE plan only (not add-ons).
export const YEARLY_DISCOUNT = 0.2;

export interface AddonDefinition {
  id: string;
  name: string;
  /** Monthly price in cents. Null = price TBD / coming soon. */
  monthlyCents: number | null;
  description: string;
  comingSoon?: boolean;
}

export const ADDONS: AddonDefinition[] = [
  {
    id: "recurring_services",
    name: "Recurring Services",
    monthlyCents: 2900,
    description: "Manage recurring service contracts and billing cycles",
  },
  {
    id: "route_optimization",
    name: "Route Optimization",
    monthlyCents: 4900,
    description: "Optimize routes for your crews to save time and fuel",
  },
  {
    id: "portal_upsells",
    name: "Customer Portal Upsells",
    monthlyCents: 1900,
    description: "Allow customers to add optional services when paying invoices",
  },
  {
    id: "sms_notifications",
    name: "SMS Notifications",
    monthlyCents: 2900,
    description: "Send text messages to customers about jobs and appointments",
  },
  {
    id: "email_campaigns",
    name: "Email Campaigns",
    monthlyCents: 1900,
    description: "Send marketing emails and newsletters to customers (coming soon)",
    comingSoon: true,
  },
  {
    id: "fleet_management",
    name: "Fleet Management",
    monthlyCents: null,
    description: "Live GPS tracking for your crews and vehicles using their phones",
    comingSoon: true,
  },
];

// ── Email pack add-ons (future) ───────────────────────────────────────────────
// These are one-time credit top-ups, not recurring subscriptions.
// Prices in cents. Backend (email_pack_purchases table) is already built.
export interface EmailPackDefinition {
  id: string;
  size: number;       // additional emails
  priceCents: number;
  comingSoon: boolean;
}

export const EMAIL_PACKS: EmailPackDefinition[] = [
  { id: "pack_5k",  size: 5_000,  priceCents: 5000,  comingSoon: true },
  { id: "pack_10k", size: 10_000, priceCents: 9000,  comingSoon: true },
  { id: "pack_25k", size: 25_000, priceCents: 20000, comingSoon: true },
];

export const TRIAL_DAYS = 30;

export function getPlan(planId: string | null | undefined): PlanDefinition {
  if (planId && planId in PLANS) return PLANS[planId as PlanId];
  return PLANS.starter;
}

export function getAddon(addonId: string): AddonDefinition | undefined {
  return ADDONS.find((a) => a.id === addonId);
}

/**
 * Returns the charge amount in cents for a plan at the given interval.
 * Yearly = monthly * 12, then 20% discount applied to the base plan.
 */
export function getPlanChargeCents(planId: string, interval: BillingInterval): number {
  const plan = getPlan(planId);
  if (interval === "yearly") {
    return Math.round(plan.monthlyCents * 12 * (1 - YEARLY_DISCOUNT));
  }
  return plan.monthlyCents;
}

/** Sum of monthly add-on prices (in cents) for the given add-on ids. Skips coming-soon add-ons with no price. */
export function getAddonsMonthlyCents(addonIds: string[]): number {
  return addonIds.reduce((sum, id) => sum + (getAddon(id)?.monthlyCents ?? 0), 0);
}

/**
 * Returns how many emails remain in this month's allowance.
 * Returns 0 if already over the limit (use emailsOverage for that).
 */
export function emailsRemaining(planId: string, sentThisMonth: number, packCredits = 0): number {
  const plan = getPlan(planId);
  return Math.max(0, plan.emailsPerMonth + packCredits - sentThisMonth);
}

/**
 * Returns the number of emails sent beyond the monthly allowance.
 */
export function emailsOverage(planId: string, sentThisMonth: number, packCredits = 0): number {
  const plan = getPlan(planId);
  return Math.max(0, sentThisMonth - (plan.emailsPerMonth + packCredits));
}

/**
 * Returns the overage charge in cents for emails sent beyond the allowance.
 */
export function emailOverageCents(planId: string, sentThisMonth: number, packCredits = 0): number {
  const plan = getPlan(planId);
  const over = emailsOverage(planId, sentThisMonth, packCredits);
  return Math.round(over * plan.emailOverageCentsPerEmail);
}

/**
 * Returns 0–100 usage percentage (capped at 100) for the progress bar.
 */
export function emailUsagePercent(planId: string, sentThisMonth: number, packCredits = 0): number {
  const plan = getPlan(planId);
  const total = plan.emailsPerMonth + packCredits;
  return Math.min(100, Math.round((sentThisMonth / total) * 100));
}

/** Formats a cent amount as a USD currency string, e.g. 4900 -> "$49". */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  const hasFraction = dollars % 1 !== 0;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
