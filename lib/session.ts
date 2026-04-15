import { SignJWT, jwtVerify } from 'jose'

const secretKey = process.env.SESSION_SECRET
if (!secretKey) throw new Error('SESSION_SECRET env var is required')
const encodedKey = new TextEncoder().encode(secretKey)

export type SessionPayload = {
  userId: number
  email: string
  churchId: number
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    })
    if (
      typeof payload['userId'] !== 'number' ||
      typeof payload['churchId'] !== 'number' ||
      typeof payload['email'] !== 'string' ||
      typeof payload['role'] !== 'string'
    ) return null
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
