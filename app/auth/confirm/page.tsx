'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

/** Only allow same-site relative redirects. */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

function friendlyError(code: string | null, description: string | null) {
  if (code === 'otp_expired' || /expired|invalid/i.test(description ?? '')) {
    return 'This link has expired or was already used. Ask your manager to resend the invite from the Crew page, then open the newest email.'
  }
  return description?.replace(/\+/g, ' ') || 'We could not verify this link. Ask your manager to resend the invite.'
}

export default function AuthConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  const next = safeNext(searchParams.get('next'), '/admin/setup')
  const isCrewLink = next.startsWith('/crew-setup')

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const verify = async () => {
      const supabase = createClient()
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

      // Supabase reports failures (e.g. a link already opened by an email scanner) in the hash or query.
      const errCode = hash.get('error_code') ?? searchParams.get('error_code')
      const errDesc = hash.get('error_description') ?? searchParams.get('error_description')
      if (errCode || hash.get('error') || searchParams.get('error')) {
        setError(friendlyError(errCode, errDesc))
        return
      }

      try {
        const accessToken = hash.get('access_token')
        const refreshToken = hash.get('refresh_token')
        const code = searchParams.get('code')
        const tokenHash = searchParams.get('token_hash')
        const type = searchParams.get('type') as EmailOtpType | null

        if (accessToken && refreshToken) {
          // Invite and magic links from Supabase deliver tokens in the URL fragment.
          // The PKCE browser client won't read these automatically, so set the session explicitly.
          const { error: e } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (e) throw e
        } else if (code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(code)
          if (e) throw e
        } else if (tokenHash && type) {
          const { error: e } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
          if (e) throw e
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError(friendlyError('otp_expired', null))
          return
        }

        // Drop tokens from the address bar before moving on.
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        router.replace(next)
      } catch (err) {
        console.error('Auth confirm error:', err)
        setError(friendlyError(null, err instanceof Error ? err.message : null))
      }
    }

    verify()
  }, [router, searchParams, next])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-balance text-2xl font-bold text-foreground">{"We couldn't open this link"}</h1>
          <p className="text-pretty leading-relaxed text-muted-foreground">{error}</p>
          <a
            href={isCrewLink ? '/login' : '/admin'}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-6 font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            {isCrewLink ? 'Go to sign in' : 'Return to Admin Login'}
          </a>
          {isCrewLink && (
            <p className="text-sm text-muted-foreground">
              Already set a password? Sign in with your email and password.
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden="true" />
        <p className="text-muted-foreground">Verifying your invite...</p>
      </div>
    </main>
  )
}
