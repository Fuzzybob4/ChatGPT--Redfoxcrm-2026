'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeInviteAction, invitePasswordAllowed } from './actions';

export default function SetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [inviteAllowed, setInviteAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => setHasSession(!!session));
    invitePasswordAllowed().then(setInviteAllowed);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const result = await completeInviteAction(password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(result.next);
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-lg space-y-6">
        {hasSession === false || inviteAllowed === false ? (
          <div className="space-y-4 text-center">
            <h1 className="font-semibold text-lg text-foreground">Invite link expired</h1>
            <p className="text-sm text-muted-foreground">
              This invite link has expired or was already used. Ask your employer to send a new invite.
            </p>
            <Link href="/login" className="text-sm text-primary font-semibold hover:underline">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-semibold text-lg text-foreground">Create your password</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Welcome to the team! Choose a password to finish accepting your invite.
              </p>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required minLength={8} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" name="confirm" type="password" required minLength={8} />
              </div>
              <Button type="submit" disabled={isPending || hasSession !== true || inviteAllowed !== true} className="w-full">
                {isPending ? 'Saving...' : 'Continue'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
