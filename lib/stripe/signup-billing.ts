import 'server-only';

import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import {
  SIGNUP_PURPOSE,
  isReusableSignupCustomer,
  isSignupCheckoutSessionId,
  isStripeCustomerId,
  normalizeEmail,
  profileFromSignupMetadata,
  type SignupProfile,
} from '@/lib/stripe/signup-policy';

export interface LoadedSignupSession {
  session: Stripe.Checkout.Session;
  customerId: string;
  email: string;
  profile: SignupProfile;
}

export interface VerifiedSignupBilling {
  customerId: string;
  paymentMethodId: string | null;
  brand: string | null;
  last4: string | null;
}

export async function findReusableSignupCustomer(email: string): Promise<Stripe.Customer | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const listed = await stripe.customers.list({ email: normalized, limit: 10 });
  for (const customer of listed.data) {
    if (customer.metadata?.purpose !== SIGNUP_PURPOSE) continue;
    if (normalizeEmail(customer.email) !== normalized) continue;
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 1,
    });
    if (isReusableSignupCustomer(customer, normalized, subs.data.length)) return customer;
  }
  return null;
}

export async function loadSignupSession(
  sessionId: string,
): Promise<{ ok: true; value: LoadedSignupSession } | { ok: false; error: string }> {
  if (!isSignupCheckoutSessionId(sessionId)) {
    return { ok: false, error: 'Checkout session was not recognized' };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.mode !== 'setup' || session.metadata?.purpose !== SIGNUP_PURPOSE) {
    return { ok: false, error: 'Checkout session was not recognized' };
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!customerId) return { ok: false, error: 'Secure checkout could not be verified' };

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || !customer.email) {
    return { ok: false, error: 'Secure checkout could not be verified' };
  }

  return {
    ok: true,
    value: {
      session,
      customerId,
      email: normalizeEmail(customer.email),
      profile: profileFromSignupMetadata(session.metadata),
    },
  };
}

export async function finalizeLoadedSignupSession(
  loaded: LoadedSignupSession,
): Promise<
  | { ok: true; paymentMethodId: string; brand: string; last4: string }
  | { ok: false; error: string }
> {
  if (loaded.session.status !== 'complete') {
    return { ok: false, error: 'Secure checkout could not be verified' };
  }

  const setupIntentId =
    typeof loaded.session.setup_intent === 'string'
      ? loaded.session.setup_intent
      : loaded.session.setup_intent?.id;
  if (!setupIntentId) return { ok: false, error: 'No payment setup was created' };

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const setupCustomerId =
    typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id;
  if (setupCustomerId !== loaded.customerId || setupIntent.status !== 'succeeded') {
    return { ok: false, error: 'Card setup could not be verified' };
  }

  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;
  if (!paymentMethodId) return { ok: false, error: 'No payment method was saved' };

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  const pmCustomer = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
  if (pmCustomer !== loaded.customerId) {
    return { ok: false, error: 'Card setup could not be verified' };
  }

  await stripe.customers.update(loaded.customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  return {
    ok: true,
    paymentMethodId,
    brand: pm.card?.brand ?? 'card',
    last4: pm.card?.last4 ?? '••••',
  };
}

/**
 * Stripe customer and card for a new organization.
 * User metadata is not trusted: a customer id is accepted only when Stripe
 * says that customer's email is the signed-in user's email, and card details
 * are read from Stripe rather than from metadata the user can edit.
 */
export async function resolveVerifiedSignupBilling(input: {
  email: string | null | undefined;
  hintedSessionId?: string | null;
  hintedCustomerId?: string | null;
}): Promise<VerifiedSignupBilling | null> {
  const email = normalizeEmail(input.email);
  if (!email) return null;

  try {
    if (input.hintedSessionId && isSignupCheckoutSessionId(input.hintedSessionId)) {
      const fromSession = await billingFromSignupSession(input.hintedSessionId, email);
      if (fromSession) return fromSession;
    }

    const fromTaggedCustomer = await billingFromTaggedSignupCustomer(email);
    if (fromTaggedCustomer) return fromTaggedCustomer;

    if (input.hintedCustomerId && isStripeCustomerId(input.hintedCustomerId)) {
      return await billingFromCustomerId(input.hintedCustomerId, email);
    }
  } catch (err) {
    console.error(
      '[signup-billing] could not verify Stripe customer:',
      err instanceof Error ? err.message : 'unknown error',
    );
  }

  return null;
}

async function billingFromSignupSession(
  sessionId: string,
  email: string,
): Promise<VerifiedSignupBilling | null> {
  const loaded = await loadSignupSession(sessionId);
  if (!loaded.ok || loaded.value.email !== email || loaded.value.session.status !== 'complete') {
    return null;
  }

  const finalized = await readSetupIntentCard(loaded.value);
  if (!finalized) return null;
  return { customerId: loaded.value.customerId, ...finalized };
}

async function billingFromTaggedSignupCustomer(email: string): Promise<VerifiedSignupBilling | null> {
  const listed = await stripe.customers.list({ email, limit: 10 });
  for (const customer of listed.data) {
    if (customer.metadata?.purpose !== SIGNUP_PURPOSE) continue;
    if (normalizeEmail(customer.email) !== email) continue;
    const card = await readDefaultCard(customer);
    if (!card?.paymentMethodId) continue;
    return { customerId: customer.id, ...card };
  }
  return null;
}

async function billingFromCustomerId(
  customerId: string,
  email: string,
): Promise<VerifiedSignupBilling | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || normalizeEmail(customer.email) !== email) return null;
  const card = await readDefaultCard(customer);
  return {
    customerId: customer.id,
    paymentMethodId: card?.paymentMethodId ?? null,
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
  };
}

async function readSetupIntentCard(
  loaded: LoadedSignupSession,
): Promise<{ paymentMethodId: string; brand: string | null; last4: string | null } | null> {
  const setupIntentId =
    typeof loaded.session.setup_intent === 'string'
      ? loaded.session.setup_intent
      : loaded.session.setup_intent?.id;
  if (!setupIntentId) return null;

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const setupCustomerId =
    typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id;
  if (setupCustomerId !== loaded.customerId || setupIntent.status !== 'succeeded') return null;

  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;
  if (!paymentMethodId) return null;

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  const pmCustomer = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
  if (pmCustomer !== loaded.customerId) return null;

  return {
    paymentMethodId,
    brand: pm.card?.brand ?? null,
    last4: pm.card?.last4 ?? null,
  };
}

async function readDefaultCard(
  customer: Stripe.Customer,
): Promise<{ paymentMethodId: string; brand: string | null; last4: string | null } | null> {
  const raw = customer.invoice_settings?.default_payment_method;
  const paymentMethodId = typeof raw === 'string' ? raw : raw?.id;
  if (!paymentMethodId) return null;

  const pm = typeof raw === 'object' && raw ? raw : await stripe.paymentMethods.retrieve(paymentMethodId);
  const pmCustomer = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
  if (pmCustomer !== customer.id) return null;

  return {
    paymentMethodId: pm.id,
    brand: pm.card?.brand ?? null,
    last4: pm.card?.last4 ?? null,
  };
}
