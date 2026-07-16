'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function AdminSetupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    const confirm = form.get('confirm') as string;

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push('/admin/setup/profile');
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(200,57,43,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(200,57,43,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8392B] flex items-center justify-center overflow-hidden">
              <Image src="/favicon.png" alt="RedFox" width={28} height={28} className="w-7 h-7 object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-lg text-white tracking-tight">REDFOX</span>
              <span className="text-[9px] font-bold text-[#C8392B] tracking-[0.2em] uppercase">Internal Portal</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 text-center">Welcome to the team. Let&apos;s get you set up.</p>
        </div>

        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#C8392B] text-white text-xs flex items-center justify-center font-bold">1</span>
              <h1 className="text-white font-semibold text-lg">Set your password</h1>
            </div>
            <p className="text-gray-500 text-sm ml-7">Step 1 of 2 — Choose a secure password for your account.</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-gray-400 text-xs font-medium">
                New password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 focus-visible:border-[#C8392B]/50 h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm" className="text-gray-400 text-xs font-medium">
                Confirm password
              </Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Re-enter password"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 focus-visible:border-[#C8392B]/50 h-10"
              />
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-10 mt-2 bg-[#C8392B] hover:bg-[#b03223] text-white font-semibold shadow-lg shadow-red-900/30 transition-colors"
            >
              {isPending ? 'Saving...' : 'Set Password & Continue'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
