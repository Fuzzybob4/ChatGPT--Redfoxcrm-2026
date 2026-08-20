'use client';

import { useMemo, useState } from 'react';
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';
import { getStripe } from '@/lib/stripe/client';
import { finalizeSignupCard } from '@/app/(auth)/signup/actions';
import { Button } from '@/components/ui/button';
import { Lock, ShieldCheck } from 'lucide-react';

export interface SavedCard {
  paymentMethodId: string;
  brand: string;
  last4: string;
}

interface SignupCardStepProps {
  clientSecret: string;
  customerId: string;
  onComplete: (card: SavedCard) => void;
  onBack: () => void;
  submitting: boolean;
}

function CardForm({
  customerId,
  onComplete,
  onBack,
  submitting,
}: Omit<SignupCardStepProps, 'clientSecret'>) {
  const checkoutState = useCheckoutElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (checkoutState.type !== 'success') return;
    setError('');
    setProcessing(true);

    try {
      const confirmation = await checkoutState.checkout.confirm({
        returnUrl: window.location.href,
        redirect: 'if_required',
      });

      if (confirmation.type === 'error') {
        setError(confirmation.error.message ?? 'Could not save your payment method');
        setProcessing(false);
        return;
      }

      if (confirmation.session.status.type === 'complete') {
        const result = await finalizeSignupCard(customerId, confirmation.session.id);
        if (!result.ok) {
          setError(result.error);
          setProcessing(false);
          return;
        }
        onComplete({
          paymentMethodId: result.paymentMethodId,
          brand: result.brand,
          last4: result.last4,
        });
        return;
      }

      setError('Payment method could not be verified. Please try another card.');
      setProcessing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setProcessing(false);
    }
  };

  const busy = processing || submitting;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex gap-3">
        <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Free for 30 days, then billed automatically
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You won&apos;t be charged today. We keep your card securely on file and
            start your subscription when the trial ends. Cancel anytime before then.
          </p>
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Secured by Stripe
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={busy || checkoutState.type !== 'success'}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {busy ? 'Saving card...' : 'Start Free Trial'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={busy}
          className="w-full"
        >
          Back
        </Button>
      </div>
    </div>
  );
}

export function SignupCardStep({ clientSecret, ...rest }: SignupCardStepProps) {
  const stripePromise = useMemo(() => getStripe(), []);

  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: { appearance: { theme: 'stripe' } },
      }}
    >
      <CardForm {...rest} />
    </CheckoutElementsProvider>
  );
}
