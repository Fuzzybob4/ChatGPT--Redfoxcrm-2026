'use client';

import { useMemo, useState } from 'react';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
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
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements) return;
    setError('');
    setProcessing(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? 'Please check your card details');
        setProcessing(false);
        return;
      }

      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message ?? 'Could not save your card');
        setProcessing(false);
        return;
      }

      if (setupIntent && setupIntent.status === 'succeeded') {
        const result = await finalizeSignupCard(customerId, setupIntent.id);
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

      setError('Card could not be verified. Please try another card.');
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
          disabled={busy || !stripe}
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
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: 'stripe' },
      }}
    >
      <CardForm {...rest} />
    </Elements>
  );
}
