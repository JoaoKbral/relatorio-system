import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, hashPassword } from '@/lib/password'
import { encrypt } from '@/lib/session'

// Dummy hash used when the user is not found, to prevent timing-based email enumeration.
// We run bcrypt anyway so the response time is indistinguishable from a bad-password response.
let _dummyHash: string | null = null
async function getDummyHash() {
  if (!_dummyHash) _dummyHash = await hashPassword('dummy-constant-value')
  return _dummyHash
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
    include: { church: true },
  })

  // Always run bcrypt to prevent timing-based email enumeration
  if (!user || !user.active) {
    await verifyPassword(String(password), await getDummyHash())
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  if (user.role !== 'SUPER_ADMIN' && user.church?.status !== 'ACTIVE') {
    await verifyPassword(String(password), await getDummyHash())
    return NextResponse.json({ error: 'Igreja inativa ou suspensa' }, { status: 403 })
  }

  const valid = await verifyPassword(String(password), user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  const token = await encrypt({
    userId: user.id,
    email: user.email,
    churchId: user.churchId ?? null,
    churchName: user.church?.name ?? null,
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
