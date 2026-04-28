import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

export async function GET(req: NextRequest) {
  const result = await requireSuperAdmin(req)
  if (!result.ok) return result.response

  const churches = await prisma.church.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, reports: true } } },
  })

  return NextResponse.json(churches)
}

export async function POST(req: NextRequest) {
  const result = await requireSuperAdmin(req)
  if (!result.ok) return result.response

  const body = await req.json()
  const { churchName, city, cnpj, pastorName, pastorProntuario, adminName, adminEmail, adminPassword } = body

  if (!churchName?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'Nome e cidade são obrigatórios' }, { status: 400 })
  }

  const hasAdmin = adminName?.trim() && adminEmail?.trim() && adminPassword

  if (hasAdmin) {
    if (adminPassword.length < 8) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres' }, { status: 400 })
    }
    if (adminPassword.length > 72) {
      return NextResponse.json({ error: 'Senha deve ter no máximo 72 caracteres' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase().trim() } })
    if (existing) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
    }
  }

  const church = await prisma.church.create({
    data: {
      name: churchName.trim(),
      city: city.trim(),
      cnpj: cnpj?.trim() || null,
      pastorName: pastorName?.trim() || null,
      pastorProntuario: pastorProntuario?.trim() || null,
      status: 'ACTIVE',
      ...(hasAdmin ? {
        users: {
          create: {
            email: adminEmail.toLowerCase().trim(),
            passwordHash: await hashPassword(adminPassword),
            name: adminName.trim(),
            role: 'ADMIN',
          },
        },
      } : {}),
    },
    include: { _count: { select: { users: true, reports: true } } },
  })

  return NextResponse.json(church, { status: 201 })
}
