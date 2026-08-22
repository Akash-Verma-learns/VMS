import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

/**
 * A dedicated account for the gate terminal.
 *
 * The VMS allows one session per user: verifyOtpAndLogin deletes every
 * existing session for that user before creating a new one. The gateway needs
 * a long-lived ASO token to write entries, so sharing aso@upsc.gov.in with a
 * human meant each login silently evicted the other — the officer's next click
 * returned 401 and bounced them to the sign-in screen with no explanation.
 *
 * Giving the machine its own account removes the collision entirely.
 */
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'gate-terminal@upsc.gov.in' },
    update: {},
    create: {
      email: 'gate-terminal@upsc.gov.in',
      name: 'Gate Terminal (service account)',
      role: 'ASO',
    } as any,
  })
  console.log(`gate service account: ${user.email} (${user.role})`)
  console.log('mint its token with:  npm run token -- gate-terminal@upsc.gov.in')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
     .finally(() => prisma.$disconnect())
