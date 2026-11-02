'use server';

import { randomBytes } from 'crypto';
import { stripe } from '@/lib/stripe';
import {
  finalizeLoadedSignupSession,
  findReusableSignupCustomer,
  loadSignupSession,
} from '@/lib/stripe/signup-billing';
import {
  SIGNUP_PURPOSE,
  publicAppUrl,
  sanitizeSignupProfile,
  signupCheckoutReturnUrl,
  signupSessionMetadata,
  type SignupProfile,
} from '@/lib/stripe/signup-policy';

export interface SignupCheckoutInput {
  fullName: string;
  locationName: string;
  plan: string;
  billingInterval: string;
  locationCount: string;
}

/**
 * Creates a Checkout Sessions-backed Elements flow so the browser can securely
 * collect and save a card before the account is created. The card is stored
 * for off-session use when the 30-day trial ends.
 *
 * Pass `profile` from the public signup form. Callers that only need a Setup
 * session (the in-app "add a card" button) omit it and keep the previous return path.
 */
export async function createSignupCheckoutSession(
  email: string,
  profile?: SignupCheckoutInput,
): Promise<
  | { ok: true; clientSecret: string; customerId: string; sessionId: string; email: string }
  | { ok: false; error: string }
> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { ok: false, error: 'Email is required' };
  }

  const signupProfile: SignupProfile | null = profile ? sanitizeSignupProfile(profile) : null;
  if (signupProfile && (!signupProfile.fullName || !signupProfile.locationName)) {
    return { ok: false, error: 'Name and location are required' };
  }

  try {
    const customer = signupProfile
      ? await reuseOrCreateSignupCustomer(normalizedEmail, signupProfile.fullName)
      : await stripe.customers.create({ email: normalizedEmail });

    const appUrl = publicAppUrl({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
    });
    const returnUrl = signupProfile ? signupCheckoutReturnUrl(appUrl) : `${appUrl}/signup`;

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      ui_mode: 'elements',
      customer: customer.id,
      currency: 'usd',
      return_url: returnUrl,
      integration_identifier: `redfox_signup_${randomLetters(8)}`,
      excluded_payment_method_types: ['us_bank_account'],
      ...(signupProfile ? { metadata: signupSessionMetadata(signupProfile) } : {}),
    });

    if (!session.client_secret) {
      return { ok: false, error: 'Could not initialize secure checkout' };
    }

    return {
      ok: true,
      clientSecret: session.client_secret,
      customerId: customer.id,
      sessionId: session.id,
      email: normalizedEmail,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to initialize secure checkout';
    return { ok: false, error: msg };
  }
}

/**
 * After the browser confirms the SetupIntent, finalize the saved card:
 * mark it as the customer's default payment method and return the card's
 * brand and last-4 for display. The customer id must belong to this session.
 */
export async function finalizeSignupCard(
  customerId: string,
  checkoutSessionId: string,
): Promise<
  | { ok: true; paymentMethodId: string; brand: string; last4: string }
  | { ok: false; error: string }
> {
  try {
    const loaded = await loadSignupSession(checkoutSessionId);
    if (!loaded.ok) return loaded;
    if (loaded.value.customerId !== customerId) {
      return { ok: false, error: 'Secure checkout could not be verified' };
    }
    return await finalizeLoadedSignupSession(loaded.value);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to finalize card';
    return { ok: false, error: msg };
  }
}

/**
 * Stripe sent the browser back to /signup?session_id=... after a redirect
 * (3D Secure). React state from the first visit is gone. Rebuild the signup
 * from the Checkout Session and, when the bank step succeeded, save the card.
 * The password is not stored; the page asks for it again before creating the account.
 */
export async function resumeSignupCheckout(sessionId: string): Promise<
  | {
      ok: true;
      status: 'complete';
      sessionId: string;
      email: string;
      fullName: string;
      locationName: string;
      plan: SignupProfile['plan'];
      billingInterval: SignupProfile['billingInterval'];
      locationCount: string;
      paymentMethodId: string;
      brand: string;
      last4: string;
    }
  | {
      ok: true;
      status: 'open';
      sessionId: string;
      clientSecret: string;
      customerId: string;
      email: string;
      fullName: string;
      locationName: string;
      plan: SignupProfile['plan'];
      billingInterval: SignupProfile['billingInterval'];
      locationCount: string;
    }
  | { ok: false; error: string }
> {
  try {
    const loaded = await loadSignupSession(sessionId);
    if (!loaded.ok) return loaded;
    const { session, customerId, email, profile } = loaded.value;
    const shared = {
      sessionId: session.id,
      email,
      fullName: profile.fullName,
      locationName: profile.locationName,
      plan: profile.plan,
      billingInterval: profile.billingInterval,
      locationCount: profile.locationCount,
    };

    if (session.status === 'open') {
      if (!session.client_secret) {
        return { ok: false, error: 'Secure checkout could not be restored. Please start again.' };
      }
      return {
        ok: true,
        status: 'open',
        clientSecret: session.client_secret,
        customerId,
        ...shared,
      };
    }

    if (session.status !== 'complete') {
      return { ok: false, error: 'This signup link has expired. Please start again.' };
    }

    const finalized = await finalizeLoadedSignupSession(loaded.value);
    if (!finalized.ok) return finalized;

    return {
      ok: true,
      status: 'complete',
      paymentMethodId: finalized.paymentMethodId,
      brand: finalized.brand,
      last4: finalized.last4,
      ...shared,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not restore signup';
    return { ok: false, error: msg };
  }
}

async function reuseOrCreateSignupCustomer(email: string, fullName: string) {
  const existing = await findReusableSignupCustomer(email);
  if (existing) {
    if (existing.name !== fullName) {
      await stripe.customers.update(existing.id, { name: fullName });
    }
    return existing;
  }
  return stripe.customers.create({
    email,
    name: fullName,
    metadata: { purpose: SIGNUP_PURPOSE },
  });
}

function randomLetters(length: number) {
  return Array.from(randomBytes(length), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
}
