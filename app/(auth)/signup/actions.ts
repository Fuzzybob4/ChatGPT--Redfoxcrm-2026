'use server';

import { randomBytes } from 'crypto';
import { stripe } from '@/lib/stripe';

/**
 * Creates a Checkout Sessions-backed Elements flow so the browser can securely
 * collect and save a card before the account is created. The card is stored
 * for off-session use when the 30-day trial ends.
 */
export async function createSignupCheckoutSession(
  email: string,
): Promise<{ ok: true; clientSecret: string; customerId: string } | { ok: false; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { ok: false, error: 'Email is required' };

  try {
    // A new signup gets its own billing customer. Reusing by email can attach a
    // new signup's card to another business that happens to use the same email.
    const customer = await stripe.customers.create({ email: normalizedEmail });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.redfoxcrm.com');

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      ui_mode: 'elements',
      customer: customer.id,
      currency: 'usd',
      return_url: `${appUrl}/signup`,
      integration_identifier: `redfox_signup_${randomLetters(8)}`,
      excluded_payment_method_types: ['us_bank_account'],
    });

    if (!session.client_secret) {
      return { ok: false, error: 'Could not initialize secure checkout' };
    }

    return { ok: true, clientSecret: session.client_secret, customerId: customer.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to initialize secure checkout';
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
  checkoutSessionId: string,
): Promise<
  | { ok: true; paymentMethodId: string; brand: string; last4: string }
  | { ok: false; error: string }
> {
  try {
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    const sessionCustomerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (sessionCustomerId !== customerId || session.status !== 'complete') {
      return { ok: false, error: 'Secure checkout could not be verified' };
    }

    const setupIntentId =
      typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id;
    if (!setupIntentId) return { ok: false, error: 'No payment setup was created' };

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

function randomLetters(length: number) {
  return Array.from(randomBytes(length), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
}
