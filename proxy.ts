import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const PUBLIC_PATHS = new Set([
  '/login',
  '/registrar',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
])

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const session = await decrypt(req.cookies.get('session')?.value)

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
