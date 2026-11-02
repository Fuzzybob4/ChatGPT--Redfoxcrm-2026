import { createClient } from '@/lib/supabase/server'
import { clearAuthIntent, currentAuthIntent, writeAuthIntent, type AuthIntentKind } from '@/lib/auth-intent'
import { amrAllows, amrMethods } from '@/lib/session-amr'

export type PasswordChangeDenial = { ok: false; error: string }

async function loadSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, methods: null as string[] | null }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.id !== user.id) return { supabase, user: null, methods: null }
  return { supabase, user, methods: amrMethods(session.access_token) }
}

/** Called after an implicit-grant setSession. Refuses a normal password sign-in. */
export async function stampAuthIntentFromSession(kind: AuthIntentKind): Promise<{ ok: boolean }> {
  const loaded = await loadSessionUser()
  if (!loaded.user) return { ok: false }
  if (kind === 'recovery') {
    if (!amrAllows(loaded.methods, 'recovery') || loaded.methods === null) return { ok: false }
  } else if (loaded.methods !== null && !amrAllows(loaded.methods, 'invite')) {
    return { ok: false }
  }
  const wrote = await writeAuthIntent(kind, loaded.user.id)
  return { ok: wrote }
}

export async function passwordChangeAllowed(kinds: AuthIntentKind | AuthIntentKind[]): Promise<boolean> {
  const loaded = await loadSessionUser()
  if (!loaded.user) return false
  for (const kind of Array.isArray(kinds) ? kinds : [kinds]) {
    if (!amrAllows(loaded.methods, kind)) continue
    const intent = await currentAuthIntent(kind)
    if (intent && intent.userId === loaded.user.id) return true
  }
  return false
}

export async function changePasswordWithIntent(
  kinds: AuthIntentKind | AuthIntentKind[],
  password: string,
): Promise<{ ok: true } | PasswordChangeDenial> {
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
  const loaded = await loadSessionUser()
  if (!loaded.user) {
    return { ok: false, error: 'Your link has expired. Request a new one and open it in this browser.' }
  }
  const list = Array.isArray(kinds) ? kinds : [kinds]
  const matched: AuthIntentKind[] = []
  for (const kind of list) {
    if (!amrAllows(loaded.methods, kind)) continue
    const intent = await currentAuthIntent(kind)
    if (intent && intent.userId === loaded.user.id) matched.push(kind)
  }
  if (matched.length === 0) {
    return { ok: false, error: 'Open the link from your email, then set the password in this browser.' }
  }
  const { error } = await loaded.supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: error.message }
  for (const kind of matched) await clearAuthIntent(kind)
  return { ok: true }
}
