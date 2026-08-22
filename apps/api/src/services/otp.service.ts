import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { mailer } from '../lib/mailer'

export async function generateAndSendOtp(email: string): Promise<string> {
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
  // No SMTP credentials means the mailer formats the message and discards it,
  // so this line is the only place the code exists. It is padded and blank-line
  // separated because it has to be findable at a glance in a scrolling request
  // log, which is how it is actually read.
  if (process.env.NODE_ENV !== 'production') {
    const banner = '─'.repeat(46)
    console.log(`\n${banner}\n  OTP for ${email}\n  ${otp}     (valid 10 minutes)\n${banner}\n`)
  }

  return otp
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
