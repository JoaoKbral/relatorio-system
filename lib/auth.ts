import { NextRequest, NextResponse } from 'next/server'
import { decrypt, SessionPayload } from '@/lib/session'

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  return decrypt(req.cookies.get('session')?.value)
}

// Returns session or a NextResponse (401/403) for the caller to return immediately
export type AuthResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

export async function requireSession(req: NextRequest): Promise<AuthResult<SessionPayload>> {
  const session = await getSession(req)
  if (!session) return { ok: false, response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  return { ok: true, data: session }
}

const ADMIN_ROLES: SessionPayload['role'][] = ['ADMIN', 'SUPER_ADMIN']

export async function requireAdmin(req: NextRequest): Promise<AuthResult<SessionPayload>> {
  const result = await requireSession(req)
  if (!result.ok) return result
  if (!ADMIN_ROLES.includes(result.data.role)) return { ok: false, response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  return result
}

export async function requireSuperAdmin(req: NextRequest): Promise<AuthResult<SessionPayload>> {
  const result = await requireSession(req)
  if (!result.ok) return result
  if (result.data.role !== 'SUPER_ADMIN') return { ok: false, response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  return result
}

export function churchScope(session: SessionPayload) {
  return { churchId: session.churchId }
}
