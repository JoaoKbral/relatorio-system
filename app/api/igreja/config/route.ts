import { NextRequest, NextResponse } from 'next/server'
import { requireChurchAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/session'

export async function GET(req: NextRequest) {
  const result = await requireChurchAdmin(req)
  if (!result.ok) return result.response

  const church = await prisma.church.findUnique({ where: { id: result.data.churchId } })
  return NextResponse.json(church)
}

export async function PUT(req: NextRequest) {
  const result = await requireChurchAdmin(req)
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

  const token = await encrypt({ ...result.data, churchName: church.name })
  const response = NextResponse.json(church)
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}
