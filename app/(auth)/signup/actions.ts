'use server';

import { stripe } from '@/lib/stripe';

/**
 * Creates (or reuses) a Stripe customer for a signing-up user and returns a
 * SetupIntent client secret so the browser can securely collect and save a
 * card BEFORE the account is created. The card is stored for off-session use
 * so we can charge it automatically when the 30-day trial ends.
 */
export async function createSignupSetupIntent(
  email: string,
): Promise<{ ok: true; clientSecret: string; customerId: string } | { ok: false; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { ok: false, error: 'Email is required' };

  try {
    // A new signup gets its own billing customer. Reusing by email can attach a
    // new signup's card to another business that happens to use the same email.
    const customer = await stripe.customers.create({ email: normalizedEmail });

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: 'off_session',
    });

    if (!setupIntent.client_secret) {
      return { ok: false, error: 'Could not initialize card setup' };
    }

    return { ok: true, clientSecret: setupIntent.client_secret, customerId: customer.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to initialize card setup';
    return { ok: false, error: msg };
  }
}

/**
 * After the browser confirms the SetupIntent, finalize the saved card:
 * mark it as the customer's default payment method and return the card's
 * brand and last-4 for display / storage in the org record.
 */
export async function finalizeSignupCard(
  customerId: string,
  setupIntentId: string,
): Promise<
  | { ok: true; paymentMethodId: string; brand: string; last4: string }
  | { ok: false; error: string }
> {
  try {
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    const setupCustomerId =
      typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id;
    if (setupCustomerId !== customerId || setupIntent.status !== 'succeeded') {
      return { ok: false, error: 'Card setup could not be verified' };
    }
    const paymentMethodId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    if (!paymentMethodId) {
      return { ok: false, error: 'No payment method was saved' };
    }

    // Set as the default payment method for future off-session invoices.
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    return {
      ok: true,
      paymentMethodId,
      brand: pm.card?.brand ?? 'card',
      last4: pm.card?.last4 ?? '••••',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to finalize card';
    return { ok: false, error: msg };
  }
}
