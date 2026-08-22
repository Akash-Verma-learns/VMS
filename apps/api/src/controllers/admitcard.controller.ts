import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { allocateSeats } from '../services/allocation.service'
import { runDataCheck } from '../services/datacheck.service'

/**
 * MOD-14: seat allotment and admit cards.
 *
 * Two distinct authorities, matching how exams themselves are handled:
 *   - ASO/SO prepare the allotment (a DRAFT nobody outside the office sees)
 *   - US releases it, which is the same role that releases an exam
 * Candidates then fetch their own card from a public endpoint, by roll number,
 * and only once it has been released.
 */

/** Read-only report. Safe to run at any time. */
export async function dataCheck(req: any, res: Response): Promise<void> {
  try {
    res.json(await runDataCheck(req.params.examId))
  } catch (error: any) {
    const notFound = error.message === 'Exam not found'
    res.status(notFound ? 404 : 500).json({ error: error.message })
  }
}

export async function runAllocation(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return }

    const prefCount = await prisma.candidatePreference.count({ where: { examId } })
    if (prefCount === 0) {
      res.status(400).json({ error: 'No candidate preferences submitted for this exam yet' })
      return
    }

    // Once cards are out, a full re-run would move seats candidates have been
    // told to attend. Switch to a supplementary allotment covering only the
    // people who joined since — otherwise a late registration can never be
    // seated at all.
    // Catch incomplete or inconsistent input before it is baked into seats.
    const check = await runDataCheck(examId)
    const blocking = check.findings.filter(f => f.severity === 'BLOCKER' && f.stage === 'ALLOTMENT')
    if (blocking.length && req.body?.ignoreWarnings !== true) {
      res.status(409).json({
        error: 'Data check found problems that will corrupt the allotment',
        blockers: blocking,
        hint: 'Fix these, or pass ignoreWarnings:true to allot anyway.',
      })
      return
    }

    const released = await prisma.seatAllocation.count({ where: { examId, status: 'RELEASED' } })
    const mode = released > 0 ? 'new-only' : 'full'

    const summary = await allocateSeats(examId, mode)

    if (mode === 'new-only' && summary.total === 0) {
      res.json({ ...summary, mode, message: 'Every candidate already has an allotment' })
      return
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `ALLOCATION_RUN examId=${examId} mode=${mode} allotted=${summary.allotted} unallotted=${summary.unallotted}`,
        ipAddress: req.ip,
      },
    })

    res.json({ ...summary, mode, dataCheck: { blockers: check.blockers, warnings: check.warnings } })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function releaseAdmitCards(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params

    const draft = await prisma.seatAllocation.count({ where: { examId, status: 'DRAFT' } })
    if (draft === 0) {
      res.status(400).json({ error: 'Nothing to release — run the allotment first' })
      return
    }

    const check = await runDataCheck(examId)
    const blocking = check.findings.filter(f => f.severity === 'BLOCKER' && f.stage !== 'ALLOTMENT')
    if (blocking.length && req.body?.force !== true) {
      res.status(409).json({
        error: 'Data check found problems that would reach candidates',
        blockers: blocking,
        hint: 'Fix these, or pass force:true to release anyway.',
      })
      return
    }

    const unallotted = await prisma.seatAllocation.count({
      where: { examId, status: 'DRAFT', venueId: null },
    })
    if (unallotted > 0 && req.body?.force !== true) {
      res.status(409).json({
        error: `${unallotted} candidate(s) have no venue. Add venue capacity and ` +
               `re-run the allotment, or pass force:true to release the rest anyway.`,
        unallotted,
      })
      return
    }

    const result = await prisma.seatAllocation.updateMany({
      where: { examId, status: 'DRAFT', ...(req.body?.force === true ? {} : { venueId: { not: null } }) },
      data: { status: 'RELEASED', releasedAt: new Date(), releasedBy: req.user.userId },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `ADMIT_CARDS_RELEASED examId=${examId} count=${result.count}`,
        ipAddress: req.ip,
      },
    })

    res.json({ released: count(result), examId })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

function count(r: { count: number }) { return r.count }

export async function listAllocations(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const { venueId, status, q } = req.query

    const where: any = { examId }
    if (venueId) where.venueId = String(venueId)
    if (status) where.status = String(status)
    if (q) {
      where.OR = [
        { rollNo: { contains: String(q), mode: 'insensitive' } },
        { candidateName: { contains: String(q), mode: 'insensitive' } },
      ]
    }

    const [rows, summary] = await Promise.all([
      prisma.seatAllocation.findMany({
        where,
        include: { venue: { select: { id: true, name: true, cityName: true } } },
        orderBy: [{ venueId: 'asc' }, { rollNo: 'asc' }],
        take: 500,
      }),
      prisma.seatAllocation.groupBy({
        by: ['status'], where: { examId }, _count: true,
      }),
    ])

    res.json({
      records: rows,
      summary: {
        draft: summary.find((s) => s.status === 'DRAFT')?._count ?? 0,
        released: summary.find((s) => s.status === 'RELEASED')?._count ?? 0,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

/** Public: a candidate fetches their own admit card. Released cards only. */
export async function lookupAdmitCard(req: Request, res: Response): Promise<void> {
  try {
    const { examCode, rollNo } = req.query
    if (!examCode || !rollNo) {
      res.status(400).json({ error: 'examCode and rollNo are required' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { examCode: String(examCode) } })
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return }

    const card = await prisma.seatAllocation.findUnique({
      where: { examId_rollNo: { examId: exam.id, rollNo: String(rollNo) } },
      include: { venue: { select: { name: true, address: true, cityName: true } } },
    })

    // A DRAFT card must look identical to no card at all, or the endpoint
    // leaks the allotment before it is officially published.
    if (!card || card.status !== 'RELEASED') {
      res.status(404).json({ error: 'No admit card has been released for this roll number yet' })
      return
    }

    res.json({
      examName: exam.name,
      examCode: exam.examCode,
      rollNo: card.rollNo,
      candidateName: card.candidateName,
      venue: card.venue?.name ?? null,
      address: card.venue?.address ?? null,
      city: card.allottedCity,
      seatNo: card.seatNo,
      preferenceRank: card.preferenceRank,
      releasedAt: card.releasedAt,
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
