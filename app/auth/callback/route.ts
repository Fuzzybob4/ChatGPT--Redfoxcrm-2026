import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { applyAuthIntent, type AuthIntentKind } from '@/lib/auth-intent'
import { signOutExistingSession, verifierCookieOptions, type SavedCookie } from '@/lib/clear-auth-session'
import { authErrorType, resolveSafeNext } from '@/lib/site-url'

function intentsForNext(next: string): AuthIntentKind[] {
  if (next === '/update-password' || next.startsWith('/update-password?')) return ['recovery']
  if (next === '/auth/set-password' || next.startsWith('/auth/set-password?')) return ['invite']
  if (next === '/admin/setup' || next.startsWith('/admin/setup?') || next.startsWith('/admin/setup/')) {
    // Admin invites and admin recovery both land here.
    return ['invite', 'recovery']
  }
  return []
}

function restoreVerifiers(response: NextResponse, saved: SavedCookie[]) {
  const options = verifierCookieOptions()
  for (const cookie of saved) response.cookies.set(cookie.name, cookie.value, options)
  return response
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const safeNext = resolveSafeNext(searchParams.get('next'), origin, '/')

  const errorRedirect = (reason: string, saved: SavedCookie[] = []) => {
    const errorUrl = new URL('/auth/error', origin)
    errorUrl.searchParams.set('reason', reason)
    const type = authErrorType(safeNext)
    if (type) errorUrl.searchParams.set('type', type)
    return restoreVerifiers(NextResponse.redirect(errorUrl), saved)
  }

  if (!code) return errorRedirect('invalid')

  const cleared = await signOutExistingSession()
  const savedVerifiers = cleared.verifiers
  if (!cleared.ok) return errorRedirect('invalid', savedVerifiers)

  // New client so the exchange reads the restored verifier, not the signed-out storage.
  const supabase = await createClient()
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data.user) {
    console.error('[v0] exchangeCodeForSession error:', exchangeError)
    const wrongBrowser = /code verifier|flow_state|pkce_code_verifier/i.test(
      `${exchangeError?.code ?? ''} ${exchangeError?.message ?? ''}`,
    )
    return errorRedirect(wrongBrowser ? 'other_browser' : 'expired', savedVerifiers)
  }

  const response = NextResponse.redirect(new URL(safeNext, origin))
  for (const kind of intentsForNext(safeNext)) {
    applyAuthIntent(response, kind, data.user.id)
  }
  return response
}
