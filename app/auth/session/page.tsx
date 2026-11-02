'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authErrorType, resolveSafeNext } from '@/lib/site-url'
import { stampRecoveryIntent } from '@/app/(auth)/update-password/actions'
import { stampInviteIntent } from '@/app/auth/set-password/actions'

/**
 * Fallback for emails still using the stock Supabase templates (implicit grant:
 * #access_token=…&refresh_token=…). New templates go through /auth/confirm.
 */
export default function AuthSessionPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      const query = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const next = resolveSafeNext(query.get('next'), window.location.origin, '/')

      const hashType = hash.get('type')
      const fail = (reason: 'expired' | 'invalid') => {
        const params = new URLSearchParams({ reason })
        const type = authErrorType(next, hashType)
        if (type) params.set('type', type)
        router.replace(`/auth/error?${params.toString()}`)
      }

      const hashError = hash.get('error_code') ?? hash.get('error')
      if (hashError) {
        fail(hashError === 'otp_expired' ? 'expired' : 'invalid')
        return
      }

      // Read the fragment before setSession. The shared browser client uses PKCE
      // and will not adopt an implicit #access_token grant on its own.
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      if (accessToken && refreshToken) {
        const { data: { session: existing } } = await supabase.auth.getSession()
        if (existing) await supabase.auth.signOut({ scope: 'local' })
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (error) {
          fail('invalid')
          return
        }
        if (next === '/update-password' || next.startsWith('/update-password?')) {
          await stampRecoveryIntent()
        } else if (next === '/auth/set-password' || next.startsWith('/auth/set-password?')) {
          await stampInviteIntent()
        } else if (next === '/admin/setup' || next.startsWith('/admin/setup')) {
          await stampInviteIntent()
          await stampRecoveryIntent()
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        fail('expired')
        return
      }
      router.replace(next)
    }
    run()
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}
