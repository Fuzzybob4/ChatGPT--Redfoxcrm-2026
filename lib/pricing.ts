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
}

// Base subscription plans — matches the public landing/pricing page.
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyCents: 4900,
    description: "Perfect for solo operators and small teams",
  },
  professional: {
    id: "professional",
    name: "Professional",
    monthlyCents: 14900,
    description: "For growing businesses with multiple crews",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyCents: 19900,
    description: "For large organizations needing custom solutions",
  },
};

// Yearly billing gives 20% off the BASE plan only (not add-ons).
export const YEARLY_DISCOUNT = 0.2;

export interface AddonDefinition {
  id: string;
  name: string;
  /** Monthly price in cents. */
  monthlyCents: number;
  description: string;
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
    description: "Send marketing emails and newsletters to customers",
  },
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

/** Sum of monthly add-on prices (in cents) for the given add-on ids. */
export function getAddonsMonthlyCents(addonIds: string[]): number {
  return addonIds.reduce((sum, id) => sum + (getAddon(id)?.monthlyCents ?? 0), 0);
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
