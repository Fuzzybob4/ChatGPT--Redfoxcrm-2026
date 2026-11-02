import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type SavedCookie = { name: string; value: string }

/**
 * Drops whatever session is already in this browser, including when it is the
 * same user. Supabase signOut also deletes the PKCE code-verifier cookie, so
 * the caller must put those cookies back on the redirect before exchanging ?code=.
 */
export async function signOutExistingSession(): Promise<{ ok: boolean; verifiers: SavedCookie[] }> {
  const jar = await cookies()
  const verifiers = jar.getAll().filter((cookie) => cookie.name.includes('-code-verifier'))
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: true, verifiers }
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  // signOut deletes the PKCE verifier. Put it back on the cookie store before
  // the next client reads it, and return the values so the redirect can re-set them.
  const options = verifierCookieOptions()
  for (const cookie of verifiers) jar.set(cookie.name, cookie.value, options)
  if (error) {
    console.error('[auth] signOut before link verify failed', error.message)
    return { ok: false, verifiers }
  }
  return { ok: true, verifiers }
}

export function verifierCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10,
  }
}
