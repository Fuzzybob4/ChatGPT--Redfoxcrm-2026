import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authErrorType, resolveSafeNext } from '@/lib/site-url'

// Where each link type goes when the email does not carry a usable `next`.
const DEFAULT_NEXT: Record<string, string> = {
  invite: '/auth/set-password',
  recovery: '/update-password',
  signup: '/',
  email: '/',
  magiclink: '/',
}

const SUPPORTED_TYPES = new Set(Object.keys(DEFAULT_NEXT))

/**
 * Email link handler. Works in any browser because verifyOtp({ token_hash })
 * does not need the PKCE code verifier that /auth/callback relies on.
 *
 *   ?token_hash=…&type=invite|recovery|signup|email|magiclink&next=…  (new templates)
 *   ?code=…&next=…   stock template + PKCE  -> forwarded to /auth/callback
 *   (no params)      stock template + implicit grant (#access_token=…) -> /auth/session
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const rawType = searchParams.get('type')
  const type = rawType && SUPPORTED_TYPES.has(rawType) ? (rawType as EmailOtpType) : null
  const next = resolveSafeNext(searchParams.get('next'), origin, (type && DEFAULT_NEXT[type]) || '/')

  const fail = (reason: 'expired' | 'invalid') => {
    const url = new URL('/auth/error', origin)
    url.searchParams.set('reason', reason)
    const errorType = authErrorType(next, type)
    if (errorType) url.searchParams.set('type', errorType)
    return NextResponse.redirect(url)
  }

  // Supabase reports verify failures (e.g. otp_expired) as query params.
  const upstreamError = searchParams.get('error_code') ?? searchParams.get('error')
  if (upstreamError) return fail(upstreamError === 'otp_expired' ? 'expired' : 'invalid')

  if (tokenHash) {
    if (!type) return fail('invalid')
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.error('[auth/confirm] verifyOtp failed', { type, code: error.code, status: error.status })
      return fail(error.code === 'otp_expired' ? 'expired' : 'invalid')
    }
    return NextResponse.redirect(new URL(next, origin))
  }

  const code = searchParams.get('code')
  if (code) {
    const url = new URL('/auth/callback', origin)
    url.searchParams.set('code', code)
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  // Implicit-grant links put tokens in the URL fragment, which the server never
  // sees. Browsers keep the fragment across this redirect.
  const url = new URL('/auth/session', origin)
  url.searchParams.set('next', next)
  return NextResponse.redirect(url)
}
