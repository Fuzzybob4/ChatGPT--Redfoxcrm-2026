import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authErrorType, resolveSafeNext } from '@/lib/site-url'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const safeNext = resolveSafeNext(searchParams.get('next'), origin, '/')

  // For Supabase recovery/invite links, the token comes as a code parameter.
  // Exchange and redirect on this same host. The PKCE verifier and the session
  // cookies are host-only, so hopping to www vs apex would drop them.
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      return NextResponse.redirect(new URL(safeNext, origin))
    }

    console.error('[v0] exchangeCodeForSession error:', exchangeError)

    // PKCE links only work in the browser that requested them (the code
    // verifier cookie lives there). Email links should use /auth/confirm.
    const errorUrl = new URL('/auth/error', origin)
    const wrongBrowser = /code verifier|flow_state|pkce_code_verifier/i.test(
      `${exchangeError.code ?? ''} ${exchangeError.message}`,
    )
    errorUrl.searchParams.set('reason', wrongBrowser ? 'other_browser' : 'expired')
    const type = authErrorType(safeNext)
    if (type) errorUrl.searchParams.set('type', type)
    return NextResponse.redirect(errorUrl)
  }

  // If we reach here, no code was provided
  return NextResponse.redirect(new URL('/auth/error?reason=invalid', origin))
}
