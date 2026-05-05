import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'
const secret = new TextEncoder().encode(JWT_SECRET)

export async function signToken(payload: object) {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 })
    return payload as { userId: string; email: string; role: string }
  } catch {
    return null
  }
}
