import { Request, Response, NextFunction } from 'express'

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: `Access denied. Required: ${allowedRoles.join(', ')}` })
      return
    }
    next()
  }
}