import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const payload = await decrypt(token)

  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
}
