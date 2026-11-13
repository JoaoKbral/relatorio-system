import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { churchName, city, cnpj, pastorName, pastorProntuario, adminName, adminEmail, adminPassword } = body

  // Reject non-string fields up front. Otherwise e.g. `cnpj: 1` crashed only
  // after the email lookup, giving a side-effect-free "does this email exist" probe.
  const fields = [churchName, city, cnpj, pastorName, pastorProntuario, adminName, adminEmail, adminPassword]
  if (fields.some((v) => v != null && typeof v !== 'string')) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  if (!churchName?.trim() || !city?.trim() || !adminName?.trim() || !adminEmail?.trim() || !adminPassword) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  if (adminPassword.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres' }, { status: 400 })
  }

  if (adminPassword.length > 72) {
    return NextResponse.json({ error: 'Senha deve ter no máximo 72 caracteres' }, { status: 400 })
  }

  // Hash before the lookup so an existing email is not answered noticeably
  // faster than a new one. The 409 message itself is kept on purpose: the app
  // sends no email, so a generic reply would leave real users without a hint.
  const passwordHash = await hashPassword(adminPassword)

  const existing = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase().trim() } })
  if (existing) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const church = await prisma.church.create({
    data: {
      name: churchName.trim(),
      city: city.trim(),
      cnpj: cnpj?.trim() || null,
      pastorName: pastorName?.trim() || null,
      pastorProntuario: pastorProntuario?.trim() || null,
      status: 'ACTIVE',
      users: {
        create: {
          email: adminEmail.toLowerCase().trim(),
          passwordHash,
          name: adminName.trim(),
          role: 'ADMIN',
        },
      },
    },
  })

  return NextResponse.json({ ok: true, churchId: church.id }, { status: 201 })
}
