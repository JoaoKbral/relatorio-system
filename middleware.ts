import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

export default async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const payload = await decrypt(token)

  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
}
