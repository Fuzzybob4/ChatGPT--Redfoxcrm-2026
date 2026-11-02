import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'

/** Proof that this browser just finished a recovery or invite link. */
export type AuthIntentKind = 'recovery' | 'invite'

const COOKIE_NAME: Record<AuthIntentKind, string> = {
  recovery: 'pw_reset',
  invite: 'invite',
}

const MAX_AGE_SECONDS = 60 * 10

function signingKey(): Buffer | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return null
  // Label keeps this use distinct from the service role key itself.
  return createHmac('sha256', secret).update('redfox.auth-intent.v1').digest()
}

export function authIntentCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}

export function mintAuthIntent(kind: AuthIntentKind, userId: string): string | null {
  const key = signingKey()
  if (!key || !userId) return null
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  const payload = Buffer.from(JSON.stringify({ k: kind, u: userId, e: exp }), 'utf8').toString('base64url')
  const mac = createHmac('sha256', key).update(payload).digest('base64url')
  return `${payload}.${mac}`
}

export function readAuthIntent(kind: AuthIntentKind, token: string | undefined | null): { userId: string } | null {
  const key = signingKey()
  if (!key || !token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expected = createHmac('sha256', key).update(payload).digest('base64url')
  const got = Buffer.from(mac)
  const want = Buffer.from(expected)
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      k?: string
      u?: string
      e?: number
    }
    if (parsed.k !== kind || !parsed.u || typeof parsed.e !== 'number') return null
    if (parsed.e < Math.floor(Date.now() / 1000)) return null
    return { userId: parsed.u }
  } catch {
    return null
  }
}

export async function currentAuthIntent(kind: AuthIntentKind): Promise<{ userId: string } | null> {
  const jar = await cookies()
  return readAuthIntent(kind, jar.get(COOKIE_NAME[kind])?.value)
}

export function applyAuthIntent(response: NextResponse, kind: AuthIntentKind, userId: string) {
  const token = mintAuthIntent(kind, userId)
  if (!token) return response
  response.cookies.set(COOKIE_NAME[kind], token, authIntentCookieOptions())
  return response
}

export async function writeAuthIntent(kind: AuthIntentKind, userId: string) {
  const token = mintAuthIntent(kind, userId)
  if (!token) return false
  const jar = await cookies()
  jar.set(COOKIE_NAME[kind], token, authIntentCookieOptions())
  return true
}

export async function clearAuthIntent(kind: AuthIntentKind) {
  const jar = await cookies()
  jar.delete(COOKIE_NAME[kind])
}
