import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api/biometria/capturar-publico') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Block self-registration — only admin can create users
  if (request.nextUrl.pathname === '/auth/register') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Role-based route protection for visualizador
  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'visualizador') {
      const path = request.nextUrl.pathname

      // Block bulk import page for visualizador
      if (path === '/dashboard/guias/importar') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/guias'
        return NextResponse.redirect(url)
      }

      const allowed = path === '/dashboard/guias' || path.startsWith('/dashboard/guias/')
      if (!allowed) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/guias'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
