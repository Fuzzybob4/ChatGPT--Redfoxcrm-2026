import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getAdminSession } from '@/lib/admin-auth';
import { adminLoginAction, adminRequestAccessAction } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  searchParams: Promise<{ error?: string; tab?: string; success?: string }>;
}

const SIGN_IN_ERRORS: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  unauthorized: 'Access denied. This portal is restricted to RedFox employees.',
  missing_fields: 'Please enter both email and password.',
  server_error: 'A server error occurred. Please try again.',
};

const REQUEST_ERRORS: Record<string, string> = {
  missing_email: 'Please enter your email address.',
  invite_failed: 'Failed to send invite. Please contact IT.',
  server_error: 'A server error occurred. Please try again.',
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (session) redirect('/admin');

  const { error, tab, success } = await searchParams;
  const isRequestTab = tab === 'request';

  const signInError = !isRequestTab && error ? (SIGN_IN_ERRORS[error] ?? 'An error occurred.') : null;
  const requestError = isRequestTab && error ? (REQUEST_ERRORS[error] ?? 'An error occurred.') : null;
  const inviteSent = success === 'invite_sent';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(200,57,43,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(200,57,43,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
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
          <p className="text-sm text-gray-500 text-center">
            Restricted access. Authorized personnel only.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1 mb-4 border border-white/[0.06]">
          <a
            href="/admin/login"
            className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors ${
              !isRequestTab
                ? 'bg-[#C8392B] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign In
          </a>
          <a
            href="/admin/login?tab=request"
            className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors ${
              isRequestTab
                ? 'bg-[#C8392B] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Request Access
          </a>
        </div>

        {/* Card */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/50">
          {!isRequestTab ? (
            <>
              <h1 className="text-white font-semibold text-lg mb-1">Sign in to Admin</h1>
              <p className="text-gray-500 text-sm mb-6">Use your RedFox employee credentials.</p>

              {signInError && (
                <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {signInError}
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
            </>
          ) : (
            <>
              <h1 className="text-white font-semibold text-lg mb-1">Request Admin Access</h1>
              <p className="text-gray-500 text-sm mb-6">
                Enter your email and we&apos;ll send you a link to set up your password.
              </p>

              {inviteSent ? (
                <div className="py-6 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">Check your email</p>
                    <p className="text-gray-400 text-sm mt-1">
                      A password setup link has been sent. It expires in 24 hours.
                    </p>
                  </div>
                  <a href="/admin/login" className="text-[#C8392B] text-sm hover:underline mt-2">
                    Back to sign in
                  </a>
                </div>
              ) : (
                <>
                  {requestError && (
                    <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {requestError}
                    </div>
                  )}
                  <form action={adminRequestAccessAction} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="req-email" className="text-gray-400 text-xs font-medium">
                        Your email address
                      </Label>
                      <Input
                        id="req-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="Christianshirrell@yahoo.com"
                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 focus-visible:border-[#C8392B]/50 h-10"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-10 mt-2 bg-[#C8392B] hover:bg-[#b03223] text-white font-semibold shadow-lg shadow-red-900/30 transition-colors"
                    >
                      Send Setup Link
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          All access attempts are logged and monitored.
        </p>
      </div>
    </div>
  );
}
