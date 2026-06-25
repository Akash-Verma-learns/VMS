import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'
import { verifyToken } from '../services/token.service'

export async function requireAuth(req: any, res: Response, next: NextFunction): Promise<void> {
  // EventSource (SSE) cannot set Authorization headers — allow ?token= query param as fallback
  const token = req.headers.authorization?.split(' ')[1] ?? (req.query?.token as string | undefined)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const session = await prisma.session.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: 'Session expired. Please log in again.' })
    return
  }

  req.user = payload
  next()
}