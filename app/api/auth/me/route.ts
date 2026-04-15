import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const result = await requireSession(req)
  if (!result.ok) return result.response

  const { data: session } = result

  const church = await prisma.church.findUnique({ where: { id: session.churchId } })

  return NextResponse.json({
    userId: session.userId,
    email: session.email,
    role: session.role,
    church,
  })
}
