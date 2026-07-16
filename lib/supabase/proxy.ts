import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Skip during build-time static generation (env vars not available)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/(auth)') ||
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
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

  // CRM routes require auth
  if (!isPublicPage && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
