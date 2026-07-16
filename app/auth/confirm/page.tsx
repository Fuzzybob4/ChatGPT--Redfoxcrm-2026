'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = createClient()
        
        // Check if there's a session after Supabase parsed the hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) throw sessionError
        
        if (session) {
          // Successfully authenticated — redirect to admin setup or next page
          const next = searchParams.get('next') ?? '/admin/setup'
          router.push(next)
        } else {
          setError('No session found. The link may have expired.')
          setLoading(false)
        }
      } catch (err) {
        console.error('[v0] Auth confirm error:', err)
        setError(err instanceof Error ? err.message : 'An error occurred during authentication')
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Authentication Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <a
            href="/admin"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded transition"
          >
            Return to Admin Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-muted-foreground">Verifying your identity...</p>
      </div>
    </div>
  )
}
