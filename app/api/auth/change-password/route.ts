import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyPassword, hashPassword } from '@/lib/password'

export async function POST(req: NextRequest) {
  const result = await requireSession(req)
  if (!result.ok) return result.response

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Nova senha deve ter no mínimo 8 caracteres' }, { status: 400 })
  }

  if (newPassword.length > 72) {
    return NextResponse.json({ error: 'Nova senha deve ter no máximo 72 caracteres' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: result.data.userId } })
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const valid = await verifyPassword(String(currentPassword), user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
  }

  const passwordHash = await hashPassword(String(newPassword))
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

  return NextResponse.json({ ok: true })
}
