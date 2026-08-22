import { Response } from 'express'
import prisma from '../lib/prisma'

export async function ingestFaceAuth(req: any, res: Response): Promise<void> {
  try {
    const records = req.body
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: 'Body must be a non-empty array of face auth records' })
      return
    }

    const created = await prisma.$transaction(
      records.map((r: any) => {
        const autoFlagged =
          r.matchResult === 'NO_MATCH' ||
          (r.matchConfidence !== undefined && r.matchConfidence !== null && r.matchConfidence < 70)

        return prisma.faceAuthRecord.create({
          data: {
            examId: r.examId,
            venueId: r.venueId,
            candidateRollNo: r.candidateRollNo,
            matchConfidence: r.matchConfidence ?? null,
            matchResult: r.matchResult,
            flagged: autoFlagged,
            flagReason: autoFlagged
              ? r.matchResult === 'NO_MATCH'
                ? 'No match found'
                : `Low confidence score: ${r.matchConfidence}%`
              : null,
          },
        })
      })
    )

    const flaggedCount = created.filter(r => r.flagged).length
    res.status(201).json({ ingested: created.length, flagged: flaggedCount })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getFlaggedRecords(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const records = await prisma.faceAuthRecord.findMany({
      where: { examId, flagged: true },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        reviewer: { select: { id: true, name: true, role: true } },
      },
      orderBy: { ingestedAt: 'desc' },
    })
    res.json(records)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function reviewFaceAuth(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { caseStatus, reviewNotes } = req.body

    const validStatuses = ['UNDER_INVESTIGATION', 'CLOSED_LEGITIMATE', 'CLOSED_MALPRACTICE', 'ESCALATED']
    if (!caseStatus || !validStatuses.includes(caseStatus)) {
      res.status(400).json({ error: `caseStatus must be one of: ${validStatuses.join(', ')}` })
      return
    }

    const record = await prisma.faceAuthRecord.findUnique({ where: { id } })
    if (!record) { res.status(404).json({ error: 'Face auth record not found' }); return }

    const updated = await prisma.faceAuthRecord.update({
      where: { id },
      data: {
        caseStatus,
        reviewedBy: req.user.userId,
        reviewedAt: new Date(),
        flagReason: reviewNotes ? `${record.flagReason ?? ''} | Review: ${reviewNotes}` : record.flagReason,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `FACEAUTH_REVIEW id=${id} rollNo=${record.candidateRollNo} caseStatus=${caseStatus}`,
        ipAddress: req.ip,
      },
    })

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function confirmJammer(req: any, res: Response): Promise<void> {
  try {
    const { examId, venueId, jammerId, isActive } = req.body
    if (!examId || !venueId || !jammerId) {
      res.status(400).json({ error: 'Missing required fields: examId, venueId, jammerId' })
      return
    }

    const status = await prisma.jammerStatus.create({
      data: {
        examId,
        venueId,
        jammerId,
        isActive: isActive ?? false,
        confirmedBy: req.user.userId,
      },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        confirmer: { select: { id: true, name: true, role: true } },
      },
    })
    res.status(201).json(status)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getJammerStatus(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const statuses = await prisma.jammerStatus.findMany({
      where: { examId },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        confirmer: { select: { id: true, name: true, role: true } },
      },
      orderBy: { confirmedAt: 'desc' },
    })
    res.json(statuses)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

// Live gate feed — every record for an exam, not just the flagged ones.
// getFlaggedRecords powers the review queue; this powers the terminal feed,
// where a successful entry is just as important to see as a rejected one.
export async function listRecords(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500)

    const records = await prisma.faceAuthRecord.findMany({
      where: { examId },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        reviewer: { select: { id: true, name: true, role: true } },
      },
      orderBy: { ingestedAt: 'desc' },
      take: limit,
    })

    const summary = {
      total: records.length,
      matched: records.filter(r => r.matchResult === 'MATCH').length,
      flagged: records.filter(r => r.flagged).length,
      pendingReview: records.filter(r => r.flagged && r.caseStatus === 'PENDING_REVIEW').length,
    }

    res.json({ summary, records })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
