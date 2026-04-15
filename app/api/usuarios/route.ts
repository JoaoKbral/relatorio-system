import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if (!result.ok) return result.response

  const users = await prisma.user.findMany({
    where: { churchId: result.data.churchId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if (!result.ok) return result.response

  const { name, email, password, role } = await req.json()

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (existing) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
      role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      churchId: result.data.churchId,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  })

  return NextResponse.json(user, { status: 201 })
}
