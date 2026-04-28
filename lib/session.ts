import { SignJWT, jwtVerify } from 'jose'

export type SessionPayload = {
  userId: number
  email: string
  churchId: number
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'
}

function getEncodedKey(): Uint8Array {
  const secretKey = process.env.SESSION_SECRET
  if (!secretKey) throw new Error('SESSION_SECRET env var is required')
  return new TextEncoder().encode(secretKey)
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getEncodedKey())
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ['HS256'],
    })
    if (
      typeof payload['userId'] !== 'number' ||
      typeof payload['churchId'] !== 'number' ||
      typeof payload['email'] !== 'string' ||
      !['SUPER_ADMIN', 'ADMIN', 'MEMBER'].includes(payload['role'] as string)
    ) return null
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
