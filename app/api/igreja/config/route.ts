import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if (!result.ok) return result.response

  const church = await prisma.church.findUnique({ where: { id: result.data.churchId } })
  return NextResponse.json(church)
}

export async function PUT(req: NextRequest) {
  const result = await requireAdmin(req)
  if (!result.ok) return result.response

  const { name, city, cnpj, pastorName, pastorProntuario } = await req.json()

  const church = await prisma.church.update({
    where: { id: result.data.churchId },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(city?.trim() ? { city: city.trim() } : {}),
      cnpj: cnpj?.trim() || null,
      pastorName: pastorName?.trim() || null,
      pastorProntuario: pastorProntuario?.trim() || null,
    },
  })

  return NextResponse.json(church)
}
