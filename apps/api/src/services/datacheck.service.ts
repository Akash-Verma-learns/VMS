import prisma from '../lib/prisma'

/**
 * MOD-15: Data completeness and consistency checks.
 *
 * Every check answers three questions, because a count on its own is not
 * actionable: what is wrong, what it will break *later* if left alone, and
 * what to do about it. Findings carry sample records so the operator can go
 * straight to the offending rows.
 *
 * These run before allotment and before release, which are the two points
 * where bad input stops being recoverable — once admit cards are published,
 * a candidate has been told which hall to attend.
 */

export type Severity = 'BLOCKER' | 'WARNING' | 'INFO'

export interface Finding {
  id: string
  severity: Severity
  title: string
  /** What is actually wrong, with numbers. */
  detail: string
  /** The downstream consequence — why this matters before it is too late. */
  consequence: string
  /** The concrete remedy. */
  fix: string
  count: number
  samples: string[]
  /** Which stage this blocks. */
  stage: 'ALLOTMENT' | 'RELEASE' | 'EXAM_DAY'
}

export interface CheckReport {
  examId: string
  examCode: string
  ranAt: string
  ok: boolean
  blockers: number
  warnings: number
  findings: Finding[]
  /** Everything that was inspected, so a clean report is not mistaken for no data. */
  inspected: Record<string, number>
}

const sample = (xs: string[], n = 8) => xs.slice(0, n)

export async function runDataCheck(examId: string): Promise<CheckReport> {
  const exam = await prisma.exam.findUnique({ where: { id: examId } })
  if (!exam) throw new Error('Exam not found')

  const [prefs, assignments, centres, allocations] = await Promise.all([
    prisma.candidatePreference.findMany({ where: { examId } }),
    prisma.venueAssignment.findMany({ where: { examId }, include: { venue: true } }),
    prisma.centre.findMany({ where: { examId } }),
    prisma.seatAllocation.findMany({
      where: { examId },
      include: { venue: { select: { name: true, cityName: true } } },
    }),
  ])

  const findings: Finding[] = []
  const norm = (s: string) => s.trim().toLowerCase()

  const venueCities = new Set(assignments.filter(a => a.venue?.isActive).map(a => norm(a.venue.cityName)))
  const centreCities = new Set(centres.map(c => norm(c.cityName)))
  const totalSeats = assignments.reduce((n, a) => n + (a.seatsAllocated ?? a.venue?.capacity ?? 0), 0)

  // ---- 1. A city is offered on the form but has no venue behind it --------
  const offeredWithoutVenue = centres
    .filter(c => !venueCities.has(norm(c.cityName)))
    .map(c => c.cityName)
  if (offeredWithoutVenue.length) {
    const affected = prefs.filter(p =>
      [p.priority1, p.priority2, p.priority3, p.priority4, p.priority5]
        .some(c => c && offeredWithoutVenue.some(o => norm(o) === norm(c!)))).length
    findings.push({
      id: 'centre-without-venue',
      severity: 'BLOCKER',
      title: 'Exam centre with no venue',
      detail: `${offeredWithoutVenue.length} city offered on the preference form has no venue assigned: ${offeredWithoutVenue.join(', ')}.`,
      consequence: `The form lets candidates choose it, but allotment can never place anyone there. ${affected} candidate(s) have already picked one of these cities and will silently fall through to a later preference — or to nothing.`,
      fix: 'Assign a venue in that city, or remove the centre so the form stops offering it.',
      count: offeredWithoutVenue.length,
      samples: sample(offeredWithoutVenue),
      stage: 'ALLOTMENT',
    })
  }

  // ---- 2. A candidate picked a city that is not offered at all ------------
  const badCityRolls: string[] = []
  for (const p of prefs) {
    const chosen = [p.priority1, p.priority2, p.priority3, p.priority4, p.priority5].filter(Boolean) as string[]
    if (chosen.some(c => !centreCities.has(norm(c)) && !venueCities.has(norm(c)))) badCityRolls.push(p.rollNo)
  }
  if (badCityRolls.length) {
    findings.push({
      id: 'preference-unknown-city',
      severity: 'WARNING',
      title: 'Preference naming an unknown city',
      detail: `${badCityRolls.length} candidate(s) chose a city that is neither an exam centre nor a venue city.`,
      consequence: 'Those preferences are dead weight — allotment skips them, so the candidate is effectively expressing fewer choices than they think.',
      fix: 'Correct the submission, or add the city as a centre with a venue.',
      count: badCityRolls.length,
      samples: sample(badCityRolls),
      stage: 'ALLOTMENT',
    })
  }

  // ---- 3. Not enough seats -----------------------------------------------
  if (prefs.length > totalSeats) {
    findings.push({
      id: 'capacity-shortfall',
      severity: 'BLOCKER',
      title: 'More candidates than seats',
      detail: `${prefs.length} candidates, ${totalSeats} seats across ${assignments.length} venue(s).`,
      consequence: `At least ${prefs.length - totalSeats} candidate(s) cannot be seated anywhere and will be allotted no venue at all.`,
      fix: 'Raise venue capacity, add a venue, or accept the shortfall explicitly before releasing.',
      count: prefs.length - totalSeats,
      samples: [],
      stage: 'ALLOTMENT',
    })
  }

  // ---- 4. Per-city demand exceeds that city's seats ------------------------
  const seatsByCity = new Map<string, number>()
  for (const a of assignments) {
    if (!a.venue?.isActive) continue
    const k = norm(a.venue.cityName)
    seatsByCity.set(k, (seatsByCity.get(k) ?? 0) + (a.seatsAllocated ?? a.venue.capacity))
  }
  const firstChoiceDemand = new Map<string, number>()
  // Keyed on the normalised name for matching, but the label keeps the
  // original casing — reports that say "new delhi" read like a second bug.
  const cityLabel = new Map<string, string>()
  for (const p of prefs) {
    if (!p.priority1) continue
    const k = norm(p.priority1)
    if (!cityLabel.has(k)) cityLabel.set(k, p.priority1.trim())
    firstChoiceDemand.set(k, (firstChoiceDemand.get(k) ?? 0) + 1)
  }
  const oversubscribed = [...firstChoiceDemand.entries()]
    .filter(([city, demand]) => demand > (seatsByCity.get(city) ?? 0))
    .map(([city, demand]) =>
      `${cityLabel.get(city) ?? city} (${demand} want it, ${seatsByCity.get(city) ?? 0} seats)`)
  if (oversubscribed.length) {
    findings.push({
      id: 'city-oversubscribed',
      severity: 'INFO',
      title: 'City oversubscribed on first preference',
      detail: `${oversubscribed.length} city has more first-choice demand than seats: ${oversubscribed.join('; ')}.`,
      consequence: 'Those candidates will be moved to a later preference. That is the allotment working as designed, but it is the single most common complaint, so it is worth knowing the number before cards go out.',
      fix: 'No action needed unless you want everyone on first choice — in which case add capacity in that city.',
      count: oversubscribed.length,
      samples: sample(oversubscribed),
      stage: 'ALLOTMENT',
    })
  }

  // ---- 5. Incomplete candidate records ------------------------------------
  const noName = prefs.filter(p => !p.candidateName?.trim()).map(p => p.rollNo)
  if (noName.length) {
    findings.push({
      id: 'candidate-missing-name',
      severity: 'WARNING',
      title: 'Candidate record with no name',
      detail: `${noName.length} candidate(s) submitted a roll number but no name.`,
      consequence: 'The admit card and the gate terminal will show a blank name, so an invigilator cannot sanity-check the person in front of them against the record.',
      fix: 'Ask the candidate to resubmit the form, or fill the name from the master roll.',
      count: noName.length,
      samples: sample(noName),
      stage: 'RELEASE',
    })
  }

  const singleChoice = prefs.filter(p => !p.priority2 && !p.priority3).map(p => p.rollNo)
  if (singleChoice.length) {
    findings.push({
      id: 'preference-single-choice',
      severity: 'INFO',
      title: 'Only one city preference given',
      detail: `${singleChoice.length} candidate(s) submitted a single city with no fallback.`,
      consequence: 'If that city fills up they have nowhere to fall back to and will end up unallotted, unlike candidates who listed alternatives.',
      fix: 'Encourage additional preferences before the deadline, or accept that these are all-or-nothing.',
      count: singleChoice.length,
      samples: sample(singleChoice),
      stage: 'ALLOTMENT',
    })
  }

  // ---- 6. Roll numbers that do not look like the rest ----------------------
  // Inconsistent formats are how a candidate ends up with two identities: one
  // on the form, one at the gate.
  const lengths = new Map<number, number>()
  prefs.forEach(p => lengths.set(p.rollNo.length, (lengths.get(p.rollNo.length) ?? 0) + 1))
  const dominant = [...lengths.entries()].sort((a, b) => b[1] - a[1])[0]
  if (dominant && lengths.size > 1) {
    const odd = prefs.filter(p => p.rollNo.length !== dominant[0]).map(p => p.rollNo)
    findings.push({
      id: 'roll-format-inconsistent',
      severity: 'WARNING',
      title: 'Inconsistent roll number format',
      detail: `Most roll numbers are ${dominant[0]} characters (${dominant[1]} of ${prefs.length}); ${odd.length} differ.`,
      consequence: 'Roll number is the only key linking the form, the admit card and the fingerprint at the gate. A candidate typing 12312 where the master roll says 0012312 becomes two different people, and their biometric match will be logged against a roll nobody can find.',
      fix: 'Normalise to a fixed width (zero-padded), or confirm the odd ones are genuine.',
      count: odd.length,
      samples: sample(odd),
      stage: 'RELEASE',
    })
  }

  // ---- 7. Venues assigned but not approved --------------------------------
  const unapproved = assignments.filter(a => a.status !== 'APPROVED')
    .map(a => `${a.venue?.name ?? a.venueId} (${a.status})`)
  if (unapproved.length) {
    findings.push({
      id: 'venue-not-approved',
      severity: 'WARNING',
      title: 'Venue used before approval',
      detail: `${unapproved.length} venue assignment(s) are not APPROVED.`,
      consequence: 'Allotment will seat candidates in a venue that has not cleared the CS → SO → US chain. If it is later rejected, every candidate there needs re-allotting after their card has been issued.',
      fix: 'Complete the approval chain, or exclude the venue until it clears.',
      count: unapproved.length,
      samples: sample(unapproved),
      stage: 'ALLOTMENT',
    })
  }

  // ---- 8. Allotment integrity (only meaningful once it has run) -----------
  if (allocations.length) {
    const unallotted = allocations.filter(a => !a.venueId).map(a => a.rollNo)
    if (unallotted.length) {
      findings.push({
        id: 'allocation-no-venue',
        severity: 'BLOCKER',
        title: 'Allotted record with no venue',
        detail: `${unallotted.length} candidate(s) have an allocation row but no venue.`,
        consequence: 'They have no admit card to download and no gate will recognise them. On exam day they turn up with nothing.',
        fix: 'Add capacity and re-run the allotment before releasing.',
        count: unallotted.length,
        samples: sample(unallotted),
        stage: 'RELEASE',
      })
    }

    const seen = new Map<string, string>()
    const collisions: string[] = []
    for (const a of allocations) {
      if (!a.venueId || !a.seatNo) continue
      const key = `${a.venueId}|${a.seatNo}`
      if (seen.has(key)) collisions.push(`${a.venue?.name} seat ${a.seatNo}: ${seen.get(key)} and ${a.rollNo}`)
      else seen.set(key, a.rollNo)
    }
    if (collisions.length) {
      findings.push({
        id: 'seat-collision',
        severity: 'BLOCKER',
        title: 'Two candidates on one seat',
        detail: `${collisions.length} seat(s) are allotted twice.`,
        consequence: 'Two people arrive at the same desk. This is the kind of error that is only discovered in the hall, with no time to fix it.',
        fix: 'Re-run the allotment; if it recurs, the supplementary run has double-counted remaining capacity.',
        count: collisions.length,
        samples: sample(collisions),
        stage: 'RELEASE',
      })
    }

    const allotted = new Set(allocations.map(a => a.rollNo))
    const missing = prefs.filter(p => !allotted.has(p.rollNo)).map(p => p.rollNo)
    if (missing.length) {
      findings.push({
        id: 'preference-without-allocation',
        severity: 'WARNING',
        title: 'Candidate submitted but never allotted',
        detail: `${missing.length} candidate(s) have preferences but no allocation row.`,
        consequence: 'Usually a late submission that arrived after the allotment ran. They will not appear on any admit card list or at any gate until a supplementary allotment is run.',
        fix: 'Run the allotment again — after release it automatically becomes a supplementary run and only places these candidates.',
        count: missing.length,
        samples: sample(missing),
        stage: 'RELEASE',
      })
    }

    const stale = allocations
      .filter(a => a.venueId && !assignments.some(x => x.venueId === a.venueId))
      .map(a => `${a.rollNo} -> ${a.venue?.name ?? a.venueId}`)
    if (stale.length) {
      findings.push({
        id: 'allocation-stale-venue',
        severity: 'BLOCKER',
        title: 'Allotted to a venue no longer on this exam',
        detail: `${stale.length} allocation(s) point at a venue that is no longer assigned to this exam.`,
        consequence: 'The admit card names a hall that is not part of the exam any more, and the gate terminal at that venue will not be listed for this exam.',
        fix: 'Re-assign the venue to the exam, or re-run the allotment to move those candidates.',
        count: stale.length,
        samples: sample(stale),
        stage: 'EXAM_DAY',
      })
    }
  }

  const blockers = findings.filter(f => f.severity === 'BLOCKER').length
  const warnings = findings.filter(f => f.severity === 'WARNING').length

  return {
    examId,
    examCode: exam.examCode,
    ranAt: new Date().toISOString(),
    ok: blockers === 0,
    blockers,
    warnings,
    findings: findings.sort((a, b) => {
      const rank = { BLOCKER: 0, WARNING: 1, INFO: 2 }
      return rank[a.severity] - rank[b.severity]
    }),
    inspected: {
      candidates: prefs.length,
      centres: centres.length,
      venues: assignments.length,
      seats: totalSeats,
      allocations: allocations.length,
    },
  }
}
