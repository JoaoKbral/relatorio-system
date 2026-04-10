import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { encrypt } from '@/lib/session'

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const validEmail = process.env.AUTH_EMAIL ?? ''
  const validPassword = process.env.AUTH_PASSWORD ?? ''

  const valid = safeCompare(email ?? '', validEmail) && safeCompare(password ?? '', validPassword)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  const token = await encrypt({ email })

  const response = NextResponse.json({ ok: true }, { status: 200 })

  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
