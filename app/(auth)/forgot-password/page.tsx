'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const redirectTo =
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
        `${window.location.origin}/auth/callback?next=/update-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) throw new Error(resetError.message);

      // Always show the same confirmation, regardless of whether the email
      // exists, so we never reveal which addresses have an account.
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

        <div className="bg-card rounded-lg shadow-lg p-8 space-y-6">
          {submitted ? (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>,
                we&apos;ve sent a link to reset your password.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 text-sm text-primary font-semibold hover:underline"
              >
                <ArrowLeft className="size-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Reset your password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {isLoading ? 'Sending link...' : 'Send reset link'}
                </Button>
              </form>

              <div className="text-center text-sm">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
