import nodemailer from 'nodemailer'

const configured = !!(process.env.SMTP_USER && process.env.SMTP_PASS)

export const mailer = configured
  ? nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    })
  : nodemailer.createTransport({ jsonTransport: true })
