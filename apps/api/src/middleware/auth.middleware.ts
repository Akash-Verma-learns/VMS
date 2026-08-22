import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'
import { verifyToken } from '../services/token.service'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Every rejected request, appended to apps/api/rejected-auth.log.
 *
 * A 401 signs the user out of the browser instantly, so by the time anyone
 * looks, the evidence — which request failed and why — is gone. Three distinct
 * causes return the same status here, and telling them apart from the client is
 * impossible. Recording the cause at the point of rejection is the only way to
 * know which one actually fires.
 */
function recordRejection(req: any, reason: string): void {
  if (process.env.NODE_ENV === 'production') return
  const line = `${new Date().toISOString()}  ${reason.padEnd(18)} ${req.method} ${req.originalUrl}\n`
  try {
    fs.appendFileSync(path.join(__dirname, '../../rejected-auth.log'), line)
  } catch {
    /* diagnostics must never break a request */
  }
  console.warn(`  [401] ${reason} — ${req.method} ${req.originalUrl}`)
}

export async function requireAuth(req: any, res: Response, next: NextFunction): Promise<void> {
  // EventSource (SSE) cannot set Authorization headers — allow ?token= query param as fallback
  const token = req.headers.authorization?.split(' ')[1] ?? (req.query?.token as string | undefined)
  if (!token) {
    recordRejection(req, 'no-token')
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const payload = verifyToken(token)
  if (!payload) {
    recordRejection(req, 'bad-signature')
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const session = await prisma.session.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date()) {
    recordRejection(req, session ? 'session-expired' : 'session-missing')
    res.status(401).json({ error: 'Session expired. Please log in again.' })
    return
  }

  req.user = payload
  next()
}