import { Response } from 'express'
import prisma from '../lib/prisma'

export async function submitCheckpoint(req: any, res: Response): Promise<void> {
  try {
    const { examId, venueId, type, data, photoUrls, isDrillMode } = req.body
    if (!examId || !venueId || !type || !data) {
      res.status(400).json({ error: 'Missing required fields: examId, venueId, type, data' })
      return
    }

    if (isDrillMode) {
      const drill = await prisma.drillSubmission.create({
        data: {
          examId,
          venueId,
          submittedBy: req.user.userId,
          type,
          data,
          photoUrls: photoUrls ?? [],
        },
      })
      res.status(201).json({ ...drill, isDrillMode: true })
      return
    }

    // GAP 2: POST_EXAM_DISPATCH requires CCTV archival confirmation
    if (type === 'POST_EXAM_DISPATCH') {
      const cctvConfirmed = await prisma.checkpointSubmission.findFirst({
        where: { examId, venueId, type: 'CCTV_ARCHIVAL_CONFIRMATION' },
      })
      if (!cctvConfirmed) {
        res.status(400).json({ error: 'CCTV archival must be confirmed before OMR dispatch.' })
        return
      }
    }

    const checkpoint = await prisma.checkpointSubmission.create({
      data: {
        examId,
        venueId,
        submittedBy: req.user.userId,
        type,
        data,
        photoUrls: photoUrls ?? [],
        isDrillMode: false,
      },
    })
    res.status(201).json(checkpoint)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getCheckpoints(req: any, res: Response): Promise<void> {
  try {
    const { examId, venueId } = req.params
    const checkpoints = await prisma.checkpointSubmission.findMany({
      where: { examId, venueId },
      include: { submitter: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(checkpoints)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function submitReadiness(req: any, res: Response): Promise<void> {
  try {
    const { examId, venueId, checklistData, isDrillMode } = req.body
    if (!examId || !venueId) {
      res.status(400).json({ error: 'Missing required fields: examId, venueId' })
      return
    }

    const readiness = await prisma.venueReadiness.create({
      data: {
        examId,
        venueId,
        vsId: req.user.userId,
        checklistData: checklistData ?? null,
        isDrillMode: isDrillMode ?? false,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })
    res.status(201).json(readiness)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getReadiness(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const readiness = await prisma.venueReadiness.findMany({
      where: { examId },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        vs: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(readiness)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function reviewReadiness(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!['REVIEWED', 'FLAGGED'].includes(status)) {
      res.status(400).json({ error: 'status must be REVIEWED or FLAGGED' })
      return
    }

    const record = await prisma.venueReadiness.findUnique({ where: { id } })
    if (!record) {
      res.status(404).json({ error: 'Readiness record not found' })
      return
    }

    const updated = await prisma.venueReadiness.update({
      where: { id },
      data: { status },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getDrillStatus(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params

    const drills = await prisma.drillSubmission.groupBy({
      by: ['submittedBy'],
      where: { examId },
      _count: { id: true },
    })

    const userIds = drills.map(d => d.submittedBy)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true },
    })

    const result = drills.map(d => ({
      userId: d.submittedBy,
      user: users.find(u => u.id === d.submittedBy),
      drillCount: d._count.id,
    }))

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
