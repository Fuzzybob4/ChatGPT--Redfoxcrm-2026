import { loadStripe, Stripe as StripeType } from "@stripe/stripe-js";

let stripePromise: Promise<StripeType | null>;

export const getStripe = async () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
  }
  return stripePromise;
};
