import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if (!result.ok) return result.response

  const { id } = await params
  const { role, active } = await req.json()

  // Ensure the user belongs to the same church
  const existing = await prisma.user.findUnique({ where: { id: Number(id) } })
  if (!existing || existing.churchId !== result.data.churchId) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const user = await prisma.user.update({
    where: { id: Number(id) },
    data: {
      ...(role !== undefined ? { role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER' } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  return NextResponse.json(user)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if (!result.ok) return result.response

  const { id } = await params

  const existing = await prisma.user.findUnique({ where: { id: Number(id) } })
  if (!existing || existing.churchId !== result.data.churchId) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  // Prevent deleting yourself
  if (existing.id === result.data.userId) {
    return NextResponse.json({ error: 'Não é possível excluir seu próprio usuário' }, { status: 400 })
  }

  await prisma.user.update({ where: { id: Number(id) }, data: { active: false } })
  return new Response(null, { status: 204 })
}
