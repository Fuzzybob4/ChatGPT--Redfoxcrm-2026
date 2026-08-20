import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (request.nextUrl.hostname === 'localhost'
      ? request.nextUrl.origin
      : 'https://www.redfoxcrm.com')

  // For Supabase recovery/invite links, the token comes as a code parameter
  if (code) {
    const supabase = await createClient()
    
    // Try to exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!exchangeError) {
      // Keep the recovery session on the same canonical host that requested
      // the reset. Switching between www/non-www drops host-only auth cookies.
      return NextResponse.redirect(new URL(safeNext, appUrl))
    }
    
    console.error('[v0] exchangeCodeForSession error:', exchangeError)
  }

  // If we reach here, auth failed or no code was provided
  return NextResponse.redirect(new URL('/auth/error', appUrl))
}
