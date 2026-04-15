import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const result = await requireSuperAdmin(req)
  if (!result.ok) return result.response

  const churches = await prisma.church.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, reports: true } } },
  })

  return NextResponse.json(churches)
}
