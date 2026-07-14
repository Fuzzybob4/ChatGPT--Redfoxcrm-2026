'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CreditCard, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { chargeSubscription } from '@/app/(crm)/billing/subscription-actions';
import {
  getPlan,
  getPlanChargeCents,
  formatCents,
  YEARLY_DISCOUNT,
  type BillingInterval,
} from '@/lib/pricing';
import { getTrialState } from '@/lib/trial';

interface SubscriptionGateProps {
  plan: string;
  trialEndsAt: string | null;
  subscriptionStatus: string;
  cardBrand: string | null;
  cardLast4: string | null;
}

export function SubscriptionGate({
  plan,
  trialEndsAt,
  subscriptionStatus,
  cardBrand,
  cardLast4,
}: SubscriptionGateProps) {
  const router = useRouter();
  const [forceOpen, setForceOpen] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const { isActive, isTrialing, daysLeft, shouldBlock } = getTrialState({
    trialEndsAt,
    subscriptionStatus,
  });

  const planDef = getPlan(plan);
  const monthlyCents = getPlanChargeCents(plan, 'monthly');
  const yearlyCents = getPlanChargeCents(plan, 'yearly');
  const yearlySavingsCents = monthlyCents * 12 - yearlyCents;

  const open = shouldBlock || forceOpen;
  const dismissible = !shouldBlock;

  const handlePay = async () => {
    setError('');
    setProcessing(true);
    try {
      const result = await chargeSubscription(interval);
      if (!result.ok) {
        setError(result.error);
        setProcessing(false);
        return;
      }
      setForceOpen(false);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const chargeNowCents = interval === 'yearly' ? yearlyCents : monthlyCents;

  return (
    <>
      {/* Trial countdown banner — shown only while actively trialing. */}
      {isTrialing && daysLeft !== null && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-accent px-4 py-2 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Clock className="size-4 text-primary shrink-0" />
            <span className="font-medium">
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left in your free trial
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setForceOpen(true)}>
            Subscribe now
          </Button>
        </div>
      )}

      {open && !isActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl">
            {dismissible && (
              <button
                onClick={() => setForceOpen(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            )}

            <div className="space-y-1.5 text-center">
              <h2 className="text-xl font-bold text-foreground text-balance">
                {shouldBlock ? 'Your free trial has ended' : 'Subscribe to RedFox CRM'}
              </h2>
              <p className="text-sm text-muted-foreground text-pretty">
                {shouldBlock
                  ? 'Choose a plan to continue using your account. You can switch or cancel anytime.'
                  : 'Lock in your plan now — you can still use the rest of your trial.'}
              </p>
            </div>

            {/* Plan summary */}
            <div className="mt-5 rounded-lg border border-border bg-accent/50 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{planDef.name} plan</p>
              <p className="text-xs text-muted-foreground">{planDef.description}</p>
            </div>

            {/* Interval choices */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInterval('monthly')}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  interval === 'monthly'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="block text-xs font-medium text-muted-foreground">Monthly</span>
                <span className="mt-1 block text-lg font-bold text-foreground">
                  {formatCents(monthlyCents)}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInterval('yearly')}
                className={`relative rounded-lg border p-3 text-left transition-colors ${
                  interval === 'yearly'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Save {Math.round(YEARLY_DISCOUNT * 100)}%
                </span>
                <span className="block text-xs font-medium text-muted-foreground">Yearly</span>
                <span className="mt-1 block text-lg font-bold text-foreground">
                  {formatCents(yearlyCents)}
                  <span className="text-xs font-normal text-muted-foreground">/yr</span>
                </span>
              </button>
            </div>

            {interval === 'yearly' && yearlySavingsCents > 0 && (
              <p className="mt-2 text-center text-xs text-primary">
                You save {formatCents(yearlySavingsCents)} per year
              </p>
            )}

            {/* Card on file */}
            {cardLast4 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                <CreditCard className="size-4 shrink-0" />
                <span>
                  We&apos;ll charge your {cardBrand ?? 'card'} ending in{' '}
                  <span className="font-medium text-foreground">{cardLast4}</span>
                </span>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <Button
              onClick={handlePay}
              disabled={processing}
              className="mt-5 w-full bg-primary hover:bg-primary/90"
            >
              {processing ? 'Processing...' : `Pay ${formatCents(chargeNowCents)} & Continue`}
            </Button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3" />
              Secure payment powered by Stripe
            </div>

            {shouldBlock && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Need help?{' '}
                <a href="/auth/signout" className="text-primary hover:underline">
                  Sign out
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
