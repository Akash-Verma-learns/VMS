import prisma from '../lib/prisma'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
})

export async function generateAndSendOtp(email: string) {
  await prisma.otpToken.deleteMany({ where: { email, used: false } })

  const otp       = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.otpToken.create({ data: { email, otp, expiresAt } })

  await transporter.sendMail({
    from:    'vms@upsc.gov.in',
    to:      email,
    subject: 'UPSC VMS Login OTP',
    text:    `Your OTP is: ${otp}. Valid for 10 minutes.`,
  })

  console.log(`[DEV] OTP for ${email}: ${otp}`)
}

export async function verifyOtp(email: string, otp: string) {
  const record = await prisma.otpToken.findFirst({
    where: { email, otp, used: false, expiresAt: { gt: new Date() } },
  })
  if (!record) return false
  await prisma.otpToken.update({ where: { id: record.id }, data: { used: true } })
  return true
}