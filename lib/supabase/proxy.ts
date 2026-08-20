import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Skip during build-time static generation (env vars not available)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  // The recovery callback must receive the untouched PKCE verifier cookie.
  // Calling getUser() here can refresh or clear auth cookies before the route
  // handler exchanges the one-time recovery code for a session.
  if (request.nextUrl.pathname === '/auth/callback') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const isAuthPage = request.nextUrl.pathname.startsWith('/(auth)') ||
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname === '/forgot-password' ||
    request.nextUrl.pathname === '/update-password' ||
    request.nextUrl.pathname.startsWith('/auth')

  const isAdminSetupPage = 
    request.nextUrl.pathname === '/admin' ||
    request.nextUrl.pathname.startsWith('/admin/setup')

  const isCrewSetupPage = 
    request.nextUrl.pathname.startsWith('/crew-setup')

  // All /admin/* paths are handled by the (admin) layout's requireAdmin()
  // Don't redirect them here — let the layout enforce the gate
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin/')

  const isPublicPage =
    request.nextUrl.pathname.startsWith('/landing') ||
    request.nextUrl.pathname === '/' ||
    isAuthPage ||
    isAdminSetupPage ||
    isCrewSetupPage ||
    isAdminPath  // Allow all /admin/* paths through — they gate themselves

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // Clear expired or revoked Supabase cookies. Public pages (especially
  // /login) must still render; redirecting /login back to itself creates an
  // infinite 307 loop for signed-out visitors.
  if (authError) {
    const response = isPublicPage
      ? NextResponse.next({ request })
      : NextResponse.redirect(new URL('/login', request.url))

    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) response.cookies.delete(name)
    })
    return response
  }

  // CRM routes require auth
  if (!isPublicPage && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
