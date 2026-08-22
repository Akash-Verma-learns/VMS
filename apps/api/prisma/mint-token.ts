import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

/**
 * Mint a session token for a seeded user, without the OTP round-trip.
 *
 * The gate terminal needs a long-lived ASO bearer token, and OTPs are stored
 * bcrypt-hashed so they cannot be read back out of the database. Tokens last
 * 8 hours, so this gets run more often than you would expect.
 *
 *   npx ts-node prisma/mint-token.ts aso@upsc.gov.in
 *
 * Note the VMS allows one session per user: minting here logs that user out
 * of the browser, and logging in via the browser invalidates this token.
 */
const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] ?? 'aso@upsc.gov.in'
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`No user ${email} — run "npm run seed" first`)

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, cityName: user.cityName ?? null },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' },
  )
  await prisma.session.deleteMany({ where: { userId: user.id } })
  await prisma.session.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 3600 * 1000) },
  })
  console.log(token)
}

main()
  .catch((e) => { console.error(e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
