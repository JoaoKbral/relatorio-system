import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const result = await requireSuperAdmin(req)
  if (!result.ok) return result.response

  const { id, userId } = await params

  const user = await prisma.user.findUnique({ where: { id: Number(userId) } })
  if (!user || user.churchId !== Number(id)) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  await prisma.user.delete({ where: { id: Number(userId) } })
  return new Response(null, { status: 204 })
}
