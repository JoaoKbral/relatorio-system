import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSuperAdmin(req)
  if (!result.ok) return result.response

  const { id } = await params

  const users = await prisma.user.findMany({
    where: { churchId: Number(id) },
    select: { id: true, name: true, email: true, role: true, active: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSuperAdmin(req)
  if (!result.ok) return result.response

  const { id } = await params
  const { name, email, password, role } = await req.json()

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres' }, { status: 400 })
  }
  if (password.length > 72) {
    return NextResponse.json({ error: 'Senha deve ter no máximo 72 caracteres' }, { status: 400 })
  }

  const church = await prisma.church.findUnique({ where: { id: Number(id) } })
  if (!church) return NextResponse.json({ error: 'Igreja não encontrada' }, { status: 404 })

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (existing) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash: await hashPassword(password),
      name: name.trim(),
      role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      churchId: Number(id),
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  return NextResponse.json(user, { status: 201 })
}
