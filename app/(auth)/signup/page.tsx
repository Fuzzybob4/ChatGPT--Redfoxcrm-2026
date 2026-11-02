'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { authEmailRedirect } from '@/lib/auth-link-origin';
import { createSignupCheckoutSession } from '@/app/(auth)/signup/actions';
import { SignupCardStep, type SavedCard } from '@/components/signup/signup-card-step';

const RESEND_COOLDOWN_SECONDS = 60;

async function resendSignupConfirmation(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const link = await authEmailRedirect('/onboarding', window.location.origin);
  if (!link.ok) return link;
  const { error } = await createClient().auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: link.redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

type Step = 'details' | 'card' | 'success';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [locationName, setLocationName] = useState('');
  const [plan, setPlan] = useState<'starter' | 'professional' | 'enterprise'>('starter');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [locationCount, setLocationCount] = useState('1');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendNotice, setResendNotice] = useState('');
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Stripe setup state carried into the card step.
  const [clientSecret, setClientSecret] = useState('');
  const [customerId, setCustomerId] = useState('');

  // Move from the details form to the card-collection step.
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await createSignupCheckoutSession(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setClientSecret(result.clientSecret);
      setCustomerId(result.customerId);
      setStep('card');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start signup');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  // Card saved on this page, including a 3DS challenge that finishes in Stripe's
  // modal. A full-page bank redirect reloads /signup and drops this state; that
  // resume screen lives on the signup billing branch and should land here too.
  const handleCardComplete = async (card: SavedCard) => {
    setError('');
    setIsLoading(true);

    try {
      const result = await signup(name, email, password, locationName, {
        stripe_customer_id: customerId,
        default_payment_method_id: card.paymentMethodId,
        plan,
        billing_interval: billingInterval,
        location_count: locationCount,
        card_brand: card.brand,
        card_last4: card.last4,
      });
      setPassword('');
      if (result.hasSession) {
        router.replace('/onboarding');
        return;
      }
      setSuccessEmail(email);
      setResendError('');
      setResendNotice('');
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      setStep('details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || resendCooldown > 0 || !successEmail) return;
    setResending(true);
    setResendError('');
    setResendNotice('');
    const result = await resendSignupConfirmation(successEmail);
    setResending(false);
    if (!result.ok) {
      setResendError(result.error);
      return;
    }
    setResendNotice('Confirmation email sent.');
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <Image
            src="/logo.png"
            alt="RedFox Logo"
            width={64}
            height={64}
            className="h-16 w-auto"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">RedFox Lighting</h1>
            <p className="text-sm text-muted-foreground mt-1">Holiday Lighting CRM</p>
          </div>
        </div>

        {/* Signup Form */}
        <div className="bg-card rounded-lg shadow-lg p-8 space-y-6">
          {step === 'success' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-foreground text-center">Card saved</h2>
                <p className="text-sm text-muted-foreground text-center">One step left before you can set up your business</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-blue-900">Confirm your email</p>
                <p className="text-sm text-blue-800">
                  We sent a confirmation link to <span className="font-semibold">{successEmail}</span>.
                  Open it in this browser or any other browser. It signs you in and takes you to finish setting up your business.
                </p>
              </div>

              {resendError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  {resendError}
                </div>
              )}
              {resendNotice && (
                <p className="text-sm text-center text-muted-foreground">{resendNotice}</p>
              )}

              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {resending
                    ? 'Sending...'
                    : resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : 'Resend confirmation email'}
                </Button>
                <Button
                  render={<Link href="/login" />}
                  variant="outline"
                  className="w-full"
                >
                  Go to sign in
                </Button>
              </div>
            </div>
          ) : step === 'card' ? (
            <>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Add a payment method</h2>
                <p className="text-sm text-muted-foreground mt-1">Step 2 of 2 &mdash; secure your 30-day free trial</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <SignupCardStep
                clientSecret={clientSecret}
                customerId={customerId}
                onComplete={handleCardComplete}
                onBack={() => setStep('details')}
                submitting={isLoading}
              />
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Get started free</h2>
                <p className="text-sm text-muted-foreground mt-1">Step 1 of 2 &mdash; create your RedFox account</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-foreground">Full Name</label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="plan" className="text-sm font-medium text-foreground">Plan</label>
              <select id="plan" value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-base">
                <option value="starter">Starter — 1 location</option>
                <option value="professional">Professional — multiple locations</option>
                <option value="enterprise">Enterprise — all locations</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="billing-interval" className="text-sm font-medium text-foreground">Billing interval</label>
              <select id="billing-interval" value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as typeof billingInterval)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-base">
                <option value="monthly">Monthly</option>
                <option value="yearly">Annual</option>
              </select>
            </div>

            {plan !== 'starter' && (
              <div className="space-y-1.5">
                <label htmlFor="location-count" className="text-sm font-medium text-foreground">Number of locations</label>
                <Input id="location-count" type="number" min="1" value={locationCount} onChange={(e) => setLocationCount(e.target.value)} required />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="location" className="text-sm font-medium text-foreground">Primary location name</label>
              <Input
                id="location"
                type="text"
                placeholder="e.g., Austin, TX"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                required
              />
            </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {isLoading ? 'Please wait...' : 'Continue'}
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our{' '}
          <a href="/landing/terms" className="underline hover:text-foreground">Terms of Service</a>
        </p>
      </div>
    </div>
  );
}
