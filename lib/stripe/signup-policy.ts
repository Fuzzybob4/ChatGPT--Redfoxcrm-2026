/**
 * Pure rules for the public signup Checkout flow.
 * No Stripe or Supabase calls — safe to unit test and to import from anywhere.
 */

export const SIGNUP_PURPOSE = 'redfox_signup';
export const PRODUCTION_APP_URL = 'https://www.redfoxcrm.com';

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/;

export interface SignupProfile {
  fullName: string;
  locationName: string;
  plan: 'starter' | 'professional' | 'enterprise';
  billingInterval: 'monthly' | 'yearly';
  locationCount: string;
}

export interface AppUrlEnv {
  NEXT_PUBLIC_APP_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * Public origin Stripe should send the browser back to.
 * Production must not use VERCEL_URL: that host is the deployment's
 * *.vercel.app domain, which sits behind Vercel Deployment Protection.
 */
export function publicAppUrl(env: AppUrlEnv): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  if (env.VERCEL_ENV !== 'production' && env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }
  return PRODUCTION_APP_URL;
}

export function signupCheckoutReturnUrl(appUrl: string): string {
  return `${appUrl}/signup?session_id={CHECKOUT_SESSION_ID}`;
}

export function isSignupCheckoutSessionId(sessionId: string): boolean {
  return SESSION_ID.test(sessionId);
}

export function isStripeCustomerId(customerId: string): boolean {
  return CUSTOMER_ID.test(customerId);
}

export function clipMetadata(value: string, max = 200): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

export function sanitizeSignupProfile(input: {
  fullName?: string;
  locationName?: string;
  plan?: string;
  billingInterval?: string;
  locationCount?: string;
}): SignupProfile {
  const plan =
    input.plan === 'professional' || input.plan === 'enterprise' ? input.plan : 'starter';
  const billingInterval = input.billingInterval === 'yearly' ? 'yearly' : 'monthly';
  const parsed = Number.parseInt(input.locationCount ?? '1', 10);
  const locationCount = String(Math.min(100, Math.max(1, Number.isFinite(parsed) ? parsed : 1)));
  return {
    fullName: clipMetadata(input.fullName ?? ''),
    locationName: clipMetadata(input.locationName ?? ''),
    plan,
    billingInterval,
    locationCount: plan === 'starter' ? '1' : locationCount,
  };
}

export function signupSessionMetadata(profile: SignupProfile): Record<string, string> {
  return {
    purpose: SIGNUP_PURPOSE,
    full_name: profile.fullName,
    location_name: profile.locationName,
    plan: profile.plan,
    billing_interval: profile.billingInterval,
    location_count: profile.locationCount,
  };
}

export function profileFromSignupMetadata(
  metadata: Record<string, string> | null | undefined,
): SignupProfile {
  return sanitizeSignupProfile({
    fullName: metadata?.full_name,
    locationName: metadata?.location_name,
    plan: metadata?.plan,
    billingInterval: metadata?.billing_interval,
    locationCount: metadata?.location_count,
  });
}

/**
 * A retry may reuse a Stripe customer only when it is one of our own
 * abandoned signup customers: same email, tagged by us, and never subscribed.
 * A customer that has ever had a subscription stays untouched so a new signup
 * cannot replace another business's card.
 */
export function isReusableSignupCustomer(
  customer: { email?: string | null; metadata?: Record<string, string> | null },
  email: string,
  subscriptionCount: number,
): boolean {
  if (subscriptionCount > 0) return false;
  if (normalizeEmail(customer.email) !== normalizeEmail(email)) return false;
  return customer.metadata?.purpose === SIGNUP_PURPOSE;
}
