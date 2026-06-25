import jwt from 'jsonwebtoken'

export interface TokenPayload {
  userId:   string
  email:    string
  role:     string
  cityName: string | null
}

export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '8h' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload
  } catch {
    return null
  }
}
