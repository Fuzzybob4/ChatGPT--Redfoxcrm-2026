'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Check, Building2, CreditCard, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  createOrganization,
  setPaymentProvider,
  startStripeConnect,
  type BusinessDetailsInput,
} from '@/app/onboarding/actions';

type Provider = 'stripe' | 'square' | 'quickbooks' | 'none';

const VERTICALS = [
  'Holiday Lighting',
  'Landscaping',
  'Pest Control',
  'Pool Service',
  'Cleaning',
  'Other',
];

const PROVIDERS: {
  id: Provider;
  name: string;
  description: string;
  status: string;
}[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept cards and online payments. Connect your account now.',
    status: 'Recommended',
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Connect Square for in-person and online payments.',
    status: 'Set up later',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync invoices and payments with QuickBooks.',
    status: 'Set up later',
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>('stripe');

  const [details, setDetails] = useState<BusinessDetailsInput>({
    businessName: '',
    vertical: 'Holiday Lighting',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const update = (key: keyof BusinessDetailsInput, value: string) =>
    setDetails((d) => ({ ...d, [key]: value }));

  async function handleCreateOrg() {
    setError('');
    if (!details.businessName.trim()) {
      setError('Please enter your business name.');
      return;
    }
    setSubmitting(true);
    const res = await createOrganization(details);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOrgId(res.orgId);
    setStep(2);
  }

  async function handlePayment() {
    if (!orgId) return;
    setError('');
    setSubmitting(true);

    if (provider === 'stripe') {
      const connect = await startStripeConnect(orgId);
      if (connect.ok) {
        window.location.href = connect.url;
        return;
      }
      // Connect not available — record the selection and continue.
      await setPaymentProvider(orgId, 'stripe');
      setError(
        'Stripe Connect could not be started right now, but Stripe is selected. You can finish connecting from Settings.',
      );
      setSubmitting(false);
      setStep(3);
      return;
    }

    await setPaymentProvider(orgId, provider);
    setSubmitting(false);
    setStep(3);
  }

  function finish() {
    router.push('/dashboard');
    router.refresh();
  }

  const steps = [
    { n: 1, label: 'Business', icon: Building2 },
    { n: 2, label: 'Payments', icon: CreditCard },
    { n: 3, label: 'Finish', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="RedFox" width={56} height={56} className="h-14 w-auto" />
          <div>
            <h1 className="text-2xl font-bold text-foreground text-balance">
              Set up your business
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              A few quick steps and your CRM is ready to go.
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="space-y-3">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between">
            {steps.map((s) => {
              const done = step > s.n;
              const active = step === s.n;
              const Icon = s.icon;
              return (
                <div key={s.n} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
                      done
                        ? 'bg-primary border-primary text-primary-foreground'
                        : active
                          ? 'border-primary text-primary'
                          : 'border-border text-muted-foreground'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      active ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step content */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Business details</h2>
              <div className="space-y-1.5">
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  value={details.businessName}
                  onChange={(e) => update('businessName', e.target.value)}
                  placeholder="RedFox Lighting Co."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vertical">Industry</Label>
                <select
                  id="vertical"
                  value={details.vertical}
                  onChange={(e) => update('vertical', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                >
                  {VERTICALS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={details.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="(512) 555-0100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Business email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={details.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="hello@business.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Street address</Label>
                <Input
                  id="address"
                  value={details.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={details.city} onChange={(e) => update('city', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={details.state} onChange={(e) => update('state', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input id="zip" value={details.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleCreateOrg} disabled={submitting}>
                  {submitting ? 'Creating...' : 'Continue'}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Payment processing</h2>
              <p className="text-sm text-muted-foreground">
                Choose how you&apos;ll collect payments. You can change this later in Settings.
              </p>

              <div className="space-y-3">
                {PROVIDERS.map((p) => {
                  const selected = provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      className={`flex w-full items-start justify-between rounded-lg border p-4 text-left transition-colors ${
                        selected ? 'border-primary bg-accent/50' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{p.name}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {p.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                      </div>
                      <div
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handlePayment} disabled={submitting}>
                  {submitting
                    ? 'Working...'
                    : provider === 'stripe'
                      ? 'Connect Stripe'
                      : 'Continue'}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">You&apos;re all set</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {details.businessName} is ready. Head to your dashboard to add customers,
                  create estimates, and schedule jobs.
                </p>
              </div>
              <Button onClick={finish} className="w-full">
                Go to dashboard
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
