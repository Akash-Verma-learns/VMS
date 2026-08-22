import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

/**
 * Demo data for the exam-gate story: venues in three cities, assigned to the
 * released exam, plus candidates whose city preferences deliberately overflow
 * the smaller venues so the priority fallback is visible in the allotment.
 *
 * Safe to re-run: everything is upserted or keyed on a stable identifier.
 */
const prisma = new PrismaClient()

const EXAM_CODE = 'UPSC/2026/CSM'   // the RELEASED exam

const VENUES = [
  { name: 'Delhi Central Venue',      city: 'New Delhi', capacity: 10, address: '1 Rajpath, New Delhi' },
  { name: 'Noida Sector 62 Centre',   city: 'Noida',     capacity: 8,  address: 'Sector 62, Noida' },
  { name: 'Gurugram Cyber Hub Centre', city: 'Gurugram', capacity: 12, address: 'Cyber Hub, Gurugram' },
]

const CITIES = ['New Delhi', 'Noida', 'Gurugram']

// The three people who actually place fingers on demo day, first in the list
// so they land in Delhi on their first preference.
const REAL = [
  { rollNo: '0001234', name: 'Kush' },
  { rollNo: '0001235', name: 'Raghav' },
  { rollNo: '0001236', name: 'Akash' },
]

const FILLER_NAMES = [
  'Ananya Sharma', 'Rohan Mehta', 'Priya Nair', 'Arjun Reddy', 'Sneha Iyer',
  'Vikram Singh', 'Neha Gupta', 'Karan Malhotra', 'Divya Rao', 'Aditya Bose',
  'Ishita Jain', 'Manav Kapoor', 'Riya Desai', 'Siddharth Menon', 'Tanvi Joshi',
  'Nikhil Verma', 'Pooja Chandra', 'Harsh Patel', 'Meera Krishnan', 'Rahul Dutta',
  'Kavya Pillai', 'Aman Tiwari',
]

async function main() {
  const exam = await prisma.exam.findUnique({ where: { examCode: EXAM_CODE } })
  if (!exam) throw new Error(`Exam ${EXAM_CODE} not found`)

  const so = await prisma.user.findUnique({ where: { email: 'so@upsc.gov.in' } })
  const cs = await prisma.user.findUnique({ where: { email: 'cs@upsc.gov.in' } })
  const vs = await prisma.user.findUnique({ where: { email: 'vs@upsc.gov.in' } })
  if (!so || !cs) throw new Error('Seed the base users first (npm run seed)')

  console.log(`Exam: ${exam.name} (${exam.examCode})`)

  // ---- venues + assignments ------------------------------------------------
  for (const v of VENUES) {
    let venue = await prisma.venue.findFirst({ where: { name: v.name } })
    if (!venue) {
      venue = await prisma.venue.create({
        data: {
          name: v.name, address: v.address, cityName: v.city,
          type: 'GOVERNMENT', capacity: v.capacity,
          approvalStatus: 'APPROVED', addedById: so.id,
        },
      })
      console.log(`  + venue ${v.name} (${v.city}, ${v.capacity} seats)`)
    }

    const existing = await prisma.venueAssignment.findFirst({
      where: { examId: exam.id, venueId: venue.id },
    })
    if (!existing) {
      await prisma.venueAssignment.create({
        data: {
          examId: exam.id, venueId: venue.id, csId: cs.id, vsId: vs?.id ?? null,
          seatsAllocated: v.capacity, status: 'APPROVED',
          submittedAt: new Date(), approvedAt: new Date(),
        },
      })
      console.log(`  + assignment ${v.name} -> ${exam.examCode}`)
    }
  }

  // ---- centres ------------------------------------------------------------
  // The public preference form offers cities from Centre rows, not from
  // venues. Without a Centre per venue city, a candidate can only choose a
  // city we have no venue in, and every allotment falls through to nothing.
  for (const v of VENUES) {
    const existing = await prisma.centre.findFirst({
      where: { examId: exam.id, cityName: v.city },
    })
    if (!existing) {
      await prisma.centre.create({
        data: {
          examId: exam.id, cityName: v.city,
          suggestedCapacity: v.capacity, finalCapacity: v.capacity,
          isReleased: true, releasedAt: new Date(),
        },
      })
      console.log(`  + centre ${v.city}`)
    }
  }

  // ---- candidate preferences ----------------------------------------------
  // Rotating priority orders so the three cities are contended differently and
  // some candidates necessarily fall through to their 2nd or 3rd choice.
  const candidates = [
    ...REAL,
    ...FILLER_NAMES.map((name, i) => ({
      rollNo: String(2000 + i).padStart(7, '0'),
      name,
    })),
  ]

  let n = 0
  for (const [i, c] of candidates.entries()) {
    const order = [
      CITIES[i % 3],
      CITIES[(i + 1) % 3],
      CITIES[(i + 2) % 3],
    ]
    await prisma.candidatePreference.upsert({
      where: { examId_rollNo: { examId: exam.id, rollNo: c.rollNo } },
      update: { candidateName: c.name, priority1: order[0], priority2: order[1], priority3: order[2] },
      create: {
        examId: exam.id, rollNo: c.rollNo, candidateName: c.name,
        priority1: order[0], priority2: order[1], priority3: order[2],
      },
    })
    n++
  }
  console.log(`  + ${n} candidate preferences`)

  const totalSeats = VENUES.reduce((s, v) => s + v.capacity, 0)
  console.log(`\nCandidates: ${n}   Seats: ${totalSeats}` +
              (n > totalSeats ? `   -> ${n - totalSeats} will be unallotted (intentional)` : ''))
  console.log(`Exam id for the terminal: ${exam.id}`)
}

main()
  .catch((e) => { console.error(e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
