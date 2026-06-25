import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { mailer } from '../lib/mailer'

export async function generateAndSendOtp(email: string) {
  // Invalidate any previous unused OTPs for this email
  await prisma.otpToken.deleteMany({ where: { email } })

  // Cryptographically secure 6-digit OTP
  const otp = String(randomInt(100000, 1000000))
  const hash = await bcrypt.hash(otp, 10)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.otpToken.create({ data: { email, otp: hash, expiresAt } })

  await mailer.sendMail({
    from: process.env.SMTP_FROM ?? 'vms@upsc.gov.in',
    to: email,
    subject: 'UPSC VMS Login OTP',
    text: `Your OTP is: ${otp}\n\nValid for 10 minutes. Do not share this with anyone.`,
  })

  // Only log OTP in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] OTP for ${email}: ${otp}`)
  }
}

export async function verifyOtp(email: string, otp: string): Promise<boolean> {
  const record = await prisma.otpToken.findFirst({
    where: { email, used: false, expiresAt: { gt: new Date() } },
  })
  if (!record) return false

  const valid = await bcrypt.compare(otp, record.otp)
  if (!valid) return false

  await prisma.otpToken.update({ where: { id: record.id }, data: { used: true } })
  return true
}
