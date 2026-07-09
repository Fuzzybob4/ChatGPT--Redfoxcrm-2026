'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [locationName, setLocationName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signup(name, email, password, locationName);
      setSuccessEmail(email);
      setSignupSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
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

        {/* Signup Form */}
        <div className="bg-card rounded-lg shadow-lg p-8 space-y-6">
          {signupSuccess ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-foreground text-center">Account created successfully!</h2>
                <p className="text-sm text-muted-foreground text-center">We&apos;re almost done setting up your account</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-blue-900">Next step:</p>
                <p className="text-sm text-blue-800">
                  Please check your email at <span className="font-semibold">{successEmail}</span> for a confirmation link. Click the link to verify your email address.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Once confirmed, you can log in to your account.</p>
                <Button
                  render={<Link href="/login" />}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Go to Login
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => setSignupSuccess(false)}
                  className="text-primary font-semibold hover:underline"
                >
                  try again
                </button>
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Get started free</h2>
                <p className="text-sm text-muted-foreground mt-1">Create your RedFox account</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
              <label htmlFor="location" className="text-sm font-medium text-foreground">Location Name</label>
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
                  {isLoading ? 'Creating account...' : 'Create Account'}
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
