import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const PUBLIC_API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
])

const AUTH_PAGES = new Set(['/login', '/registrar'])

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    PUBLIC_API_PATHS.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const session = await decrypt(req.cookies.get('session')?.value)

  if (AUTH_PAGES.has(pathname)) {
    return session
      ? NextResponse.redirect(new URL('/', req.url))
      : NextResponse.next()
  }

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (
    (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) &&
    session.role !== 'SUPER_ADMIN'
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
