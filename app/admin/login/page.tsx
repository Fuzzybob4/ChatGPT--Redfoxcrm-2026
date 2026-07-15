import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getAdminSession } from '@/lib/admin-auth';
import { adminLoginAction } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  unauthorized: 'Access denied. This area is restricted to RedFox employees.',
  missing_fields: 'Please enter both email and password.',
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (session) redirect('/admin');

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? 'An error occurred.' : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(200,57,43,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(200,57,43,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8392B] flex items-center justify-center">
              <Image src="/logo.png" alt="RedFox" width={24} height={24} className="w-6 h-6" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-lg text-white tracking-tight">REDFOX</span>
              <span className="text-[9px] font-bold text-[#C8392B] tracking-[0.2em] uppercase">Internal Portal</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Restricted access. Authorized personnel only.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/50">
          <h1 className="text-white font-semibold text-lg mb-1">Sign in to Admin</h1>
          <p className="text-gray-500 text-sm mb-6">Use your RedFox employee credentials.</p>

          {errorMessage && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {errorMessage}
            </div>
          )}

          <form action={adminLoginAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-gray-400 text-xs font-medium">
                Email address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@redfoxcrm.com"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 focus-visible:border-[#C8392B]/50 h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-gray-400 text-xs font-medium">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 focus-visible:border-[#C8392B]/50 h-10"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 mt-2 bg-[#C8392B] hover:bg-[#b03223] text-white font-semibold shadow-lg shadow-red-900/30 transition-colors"
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          All access attempts are logged and monitored.
        </p>
      </div>
    </div>
  );
}
