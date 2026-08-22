import prisma from '../lib/prisma'

/**
 * Seat allotment driven by the candidate's own city preferences.
 *
 * The public preference form collects up to five cities in priority order.
 * Allotment walks that list: priority1 first, and whenever a city has no seats
 * left it falls through to the next choice. The rank actually satisfied is
 * stored, so "why did I get this centre" has an answer.
 *
 * Capacity per venue is `seatsAllocated` from the exam's venue assignment when
 * set, otherwise the venue's own capacity — the assignment is the exam-specific
 * number and should win.
 */

export interface AllocationSummary {
  total: number
  allotted: number
  unallotted: number
  byRank: Record<string, number>
  byVenue: { venueId: string; name: string; city: string; seats: number; used: number }[]
}

/** Row-and-number seat labels: A-1 … A-30, B-1 … */
function seatLabel(index: number, perRow = 30): string {
  const row = String.fromCharCode(65 + Math.floor(index / perRow))
  return `${row}-${(index % perRow) + 1}`
}

/**
 * `mode: 'new-only'` is a supplementary allotment: it leaves every existing
 * allocation untouched and places only candidates who do not have one yet,
 * against whatever capacity is left. That is the sole way to admit a late
 * registration once cards have been released, because a full re-run would
 * move seats candidates have already been told to attend.
 */
export async function allocateSeats(
  examId: string,
  mode: 'full' | 'new-only' = 'full',
): Promise<AllocationSummary> {
  const [preferences, assignments, existing] = await Promise.all([
    prisma.candidatePreference.findMany({
      where: { examId },
      orderBy: { rollNo: 'asc' },   // deterministic: same input, same allotment
    }),
    prisma.venueAssignment.findMany({
      where: { examId },
      include: { venue: true },
    }),
    // In 'full' mode only released rows survive the rewrite, so they are the
    // only ones still holding seats. In 'new-only' every row holds one.
    prisma.seatAllocation.findMany({
      where: mode === 'full' ? { examId, status: 'RELEASED' } : { examId },
      select: { rollNo: true, venueId: true },
    }),
  ])

  // Pools of remaining capacity, grouped by the city name candidates chose.
  const pools = assignments
    .filter((a) => a.venue?.isActive)
    .map((a) => ({
      venueId: a.venueId,
      name: a.venue.name,
      city: a.venue.cityName,
      seats: a.seatsAllocated ?? a.venue.capacity,
      used: 0,
    }))

  // Seats already spoken for cannot be handed out twice, and seat labels have
  // to continue past them rather than restart at A-1.
  for (const row of existing) {
    if (!row.venueId) continue
    const pool = pools.find((p) => p.venueId === row.venueId)
    if (pool) pool.used++
  }
  const alreadyPlaced = new Set(existing.map((r) => r.rollNo))

  const byCity = new Map<string, typeof pools>()
  for (const pool of pools) {
    const key = pool.city.trim().toLowerCase()
    if (!byCity.has(key)) byCity.set(key, [])
    byCity.get(key)!.push(pool)
  }

  const byRank: Record<string, number> = {}
  const rows: {
    examId: string; rollNo: string; candidateName: string | null
    venueId: string | null; allottedCity: string | null
    seatNo: string | null; preferenceRank: number | null
  }[] = []

  for (const pref of preferences) {
    if (alreadyPlaced.has(pref.rollNo)) continue
    const choices = [pref.priority1, pref.priority2, pref.priority3, pref.priority4, pref.priority5]
    let placed = false

    for (let rank = 0; rank < choices.length; rank++) {
      const city = choices[rank]
      if (!city) continue
      const pool = (byCity.get(city.trim().toLowerCase()) ?? []).find((p) => p.used < p.seats)
      if (!pool) continue

      rows.push({
        examId,
        rollNo: pref.rollNo,
        candidateName: pref.candidateName,
        venueId: pool.venueId,
        allottedCity: pool.city,
        seatNo: seatLabel(pool.used),
        preferenceRank: rank + 1,
      })
      pool.used++
      byRank[String(rank + 1)] = (byRank[String(rank + 1)] ?? 0) + 1
      placed = true
      break
    }

    if (!placed) {
      // Every chosen city is full (or has no venue). Recorded rather than
      // silently dropped, so the shortfall is visible instead of a candidate
      // simply never receiving an admit card.
      rows.push({
        examId, rollNo: pref.rollNo, candidateName: pref.candidateName,
        venueId: null, allottedCity: null, seatNo: null, preferenceRank: null,
      })
      byRank.none = (byRank.none ?? 0) + 1
    }
  }

  // Replace only the DRAFT rows; anything already released is left alone and
  // is filtered out above by the caller's guard.
  const writes: any[] = []
  if (mode === 'full') {
    writes.push(prisma.seatAllocation.deleteMany({ where: { examId, status: 'DRAFT' } }))
  }
  writes.push(prisma.seatAllocation.createMany({ data: rows, skipDuplicates: true }))
  await prisma.$transaction(writes)

  return {
    total: rows.length,
    allotted: rows.filter((r) => r.venueId).length,
    unallotted: rows.filter((r) => !r.venueId).length,
    byRank,
    byVenue: pools.map(({ venueId, name, city, seats, used }) => ({ venueId, name, city, seats, used })),
  }
}
