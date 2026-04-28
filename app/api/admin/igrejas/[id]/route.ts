import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSuperAdmin(req)
  if (!result.ok) return result.response

  const { id } = await params
  const body = await req.json()
  const { plan, status, name, city, cnpj, pastorName, pastorProntuario } = body

  const VALID_PLAN = ['FREE', 'PAID']
  const VALID_STATUS = ['PENDING', 'ACTIVE', 'SUSPENDED']
  if (plan !== undefined && !VALID_PLAN.includes(plan)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }
  if (status !== undefined && !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }
  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const target = await prisma.church.findUnique({ where: { id: Number(id) } })
  if (!target) return NextResponse.json({ error: 'Igreja não encontrada' }, { status: 404 })

  const church = await prisma.church.update({
    where: { id: Number(id) },
    data: {
      ...(plan !== undefined ? { plan } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(city !== undefined ? { city: String(city).trim() } : {}),
      ...(cnpj !== undefined ? { cnpj: cnpj?.trim() || null } : {}),
      ...(pastorName !== undefined ? { pastorName: pastorName?.trim() || null } : {}),
      ...(pastorProntuario !== undefined ? { pastorProntuario: pastorProntuario?.trim() || null } : {}),
    },
  })

  return NextResponse.json(church)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSuperAdmin(req)
  if (!result.ok) return result.response

  const { id } = await params

  const target = await prisma.church.findUnique({ where: { id: Number(id) } })
  if (!target) return NextResponse.json({ error: 'Igreja não encontrada' }, { status: 404 })

  await prisma.church.delete({ where: { id: Number(id) } })
  return new Response(null, { status: 204 })
}
