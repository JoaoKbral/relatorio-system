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
  const { plan, status } = await req.json()

  const VALID_PLAN = ['FREE', 'PAID']
  const VALID_STATUS = ['PENDING', 'ACTIVE', 'SUSPENDED']
  if (plan !== undefined && !VALID_PLAN.includes(plan)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }
  if (status !== undefined && !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const church = await prisma.church.update({
    where: { id: Number(id) },
    data: {
      ...(plan !== undefined ? { plan } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  })

  return NextResponse.json(church)
}
