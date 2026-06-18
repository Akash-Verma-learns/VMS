import { redisPublisher } from '../lib/redis';
import { Response } from 'express'
import prisma from '../lib/prisma'

export async function assignInspection(req: any, res: Response): Promise<void> {
  try {
    const { examId, venueId, ioId, scheduledFor, isExamDay } = req.body
    if (!examId || !venueId || !ioId) {
      res.status(400).json({ error: 'Missing required fields: examId, venueId, ioId' })
      return
    }

    const io = await prisma.user.findUnique({ where: { id: ioId } })
    if (!io || io.role !== 'IO') {
      res.status(400).json({ error: 'ioId must refer to a user with role IO' })
      return
    }

    const inspection = await prisma.inspection.create({
      data: {
        examId,
        venueId,
        ioId,
        assignedBy: req.user.userId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        isExamDay: isExamDay ?? false,
      },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        io: { select: { id: true, name: true, email: true } },
        assigner: { select: { id: true, name: true, role: true } },
      },
    })
    res.status(201).json(inspection)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listInspections(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const inspections = await prisma.inspection.findMany({
      where: { examId },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        io: { select: { id: true, name: true, role: true } },
        assigner: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(inspections)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function myInspections(req: any, res: Response): Promise<void> {
  try {
    const inspections = await prisma.inspection.findMany({
      where: { ioId: req.user.userId },
      include: {
        exam: { select: { id: true, name: true, examCode: true, scheduledDate: true } },
        venue: { select: { id: true, name: true, address: true, cityName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(inspections)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function submitInspection(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    // We now expect an array of 'photos', each containing a url, lat, and lng
    const { checklistData, photos, findings, requiresRemediation } = req.body

    // 1. Validate the new 5-photo minimum with our new array structure
    if (!Array.isArray(photos) || photos.length < 5) {
      res.status(400).json({ error: 'Minimum 5 geo-tagged photos are required' })
      return
    }

    // 2. Verify the inspection exists and the correct IO is logged in
    const inspection = await prisma.inspection.findUnique({ where: { id } })
    if (!inspection) { res.status(404).json({ error: 'Inspection not found' }); return }
    if (inspection.ioId !== req.user.userId) {
      res.status(403).json({ error: 'You are not assigned to this inspection' })
      return
    }

    // 3. Update the Inspection AND save the individual geo-tagged photos
    const updated = await prisma.inspection.update({
      where: { id },
      data: {
        checklistData: checklistData ?? null,
        findings: findings ?? null,
        requiresRemediation: requiresRemediation ?? false,
        status: requiresRemediation ? 'REMEDIATION_REQUIRED' : 'SUBMITTED',
        submittedAt: new Date(),
        // This is the magic that writes to your newly created InspectionPhoto table!
        photos: {
          create: photos.map((photo: any) => ({
            photoUrl: photo.photoUrl,
            latitude: photo.latitude,
            longitude: photo.longitude,
          }))
        }
      },
    })

    // 4. Update the Venue's Risk Flag if the Inspector marked it for remediation
  // 4. Update the Venue's Risk Flag if the Inspector marked it for remediation
    if (requiresRemediation) {
      await prisma.venue.update({
        where: { id: inspection.venueId },
        data: { isHighRisk: true }
      });

      // NEW: Broadcast the SOS to the War Room instantly!
      redisPublisher.publish('war-room-alerts', JSON.stringify({
        event: 'HIGH_RISK_VENUE_FLAGGED',
        examId: inspection.examId,
        venueId: inspection.venueId,
        message: 'Critical: Venue requires immediate remediation.'
      }));
    }

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function reviewInspection(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { requiresRemediation } = req.body

    const inspection = await prisma.inspection.findUnique({ where: { id } })
    if (!inspection) { res.status(404).json({ error: 'Inspection not found' }); return }

    const updated = await prisma.inspection.update({
      where: { id },
      data: {
        status: requiresRemediation ? 'REMEDIATION_REQUIRED' : 'REVIEWED',
        requiresRemediation: requiresRemediation ?? inspection.requiresRemediation,
      },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
