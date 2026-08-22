import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { generateAndSendOtp, verifyOtp } from '../services/otp.service'
import { createToken } from '../services/token.service'

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { email } = req.body
  if (!email) {
    res.status(400).json({ error: 'Email required' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) {
    res.json({ message: 'If this email is registered, an OTP has been sent.' })
    return
  }

  await generateAndSendOtp(email)
  await prisma.auditLog.create({ data: { userId: user.id, action: 'OTP_REQUESTED', ipAddress: req.ip } })
  res.json({ message: 'OTP sent to your registered email.' })
}

export async function verifyOtpAndLogin(req: Request, res: Response): Promise<void> {
  const { email, otp } = req.body
  if (!email || !otp) {
    res.status(400).json({ error: 'Email and OTP required' })
    return
  }

  const valid = await verifyOtp(email, otp)
  if (!valid) {
    res.status(401).json({ error: 'Invalid or expired OTP.' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const token     = createToken({ userId: user.id, email: user.email, role: user.role, cityName: user.cityName ?? null })
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)

  // A venue supervisor carries a phone into the hall and leaves the portal open
  // on a desk machine; a US reviews approvals on a laptop and checks the gate
  // feed on a tablet. Deleting every other session on login made the second
  // device evict the first, and the eviction was invisible until the evicted
  // device next touched the API — at which point a 401 dropped that user at the
  // sign-in screen mid-task with no explanation.
  //
  // Concurrent sessions are allowed. Expired rows for this user are cleared on
  // the way through so the table does not grow without bound, and `logout`
  // still deletes the presenting token, so signing out remains exact.
  await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } })
  await prisma.session.create({ data: { userId: user.id, token, expiresAt } })
  await prisma.auditLog.create({ data: { userId: user.id, action: 'LOGIN_SUCCESS', ipAddress: req.ip } })

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, cityName: user.cityName ?? null } })
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) await prisma.session.deleteMany({ where: { token } })
  res.json({ message: 'Logged out successfully' })
}