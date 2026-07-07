import 'server-only';
import Stripe from 'stripe';

// Single shared Stripe client for server-side use.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  appInfo: { name: 'RedFox CRM' },
});
