import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const users = [
  { email: 'js@upsc.gov.in',  name: 'Joint Secretary',          role: 'JS'  },
  { email: 'ds@upsc.gov.in',  name: 'Deputy Secretary',         role: 'DS'  },
  { email: 'us@upsc.gov.in',  name: 'Under Secretary',          role: 'US'  },
  { email: 'so@upsc.gov.in',  name: 'Section Officer',          role: 'SO'  },
  { email: 'aso@upsc.gov.in', name: 'Assistant Section Officer', role: 'ASO' },
  { email: 'cs@upsc.gov.in',  name: 'City Superintendent',      role: 'CS'  },
  { email: 'vs@upsc.gov.in',  name: 'Venue Superintendent',     role: 'VS'  },
  { email: 'io@upsc.gov.in',  name: 'Invigilator Officer',      role: 'IO'  },
]

async function main() {
  console.log('Seeding users...')
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u as any,
    })
    console.log(`  ✓ ${u.role.padEnd(3)} — ${u.email}`)
  }
  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
