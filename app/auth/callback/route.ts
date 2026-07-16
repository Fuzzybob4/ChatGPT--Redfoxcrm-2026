import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // For Supabase recovery/invite links, the token comes as a code parameter
  if (code) {
    const supabase = await createClient()
    
    // Try to exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!exchangeError) {
      // Successfully authenticated — redirect to next page or default
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    console.error('[v0] exchangeCodeForSession error:', exchangeError)
  }

  // If we reach here, auth failed or no code was provided
  return NextResponse.redirect(`${origin}/auth/error`)
}
