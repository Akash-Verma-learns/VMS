import nodemailer from 'nodemailer'

const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

export const mailer = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    })
  : nodemailer.createTransport({ jsonTransport: true })
