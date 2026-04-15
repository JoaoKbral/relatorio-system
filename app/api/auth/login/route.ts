import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { encrypt } from '@/lib/session'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
    include: { church: true },
  })

  if (!user || !user.active) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  if (user.church.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Igreja inativa ou suspensa' }, { status: 403 })
  }

  const valid = await verifyPassword(String(password), user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  const token = await encrypt({
    userId: user.id,
    email: user.email,
    churchId: user.churchId,
    role: user.role,
  })

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
