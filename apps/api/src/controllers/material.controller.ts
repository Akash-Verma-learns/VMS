import { Response } from 'express'
import { randomUUID, randomInt } from 'crypto'
import prisma from '../lib/prisma'
import { mailer } from '../lib/mailer'

function generatePin(): string {
  return String(randomInt(10_000_000, 100_000_000))
}

export async function generateMaterialPin(req: any, res: Response): Promise<void> {
  try {
    const { examId, venueId } = req.body
    if (!examId || !venueId) {
      res.status(400).json({ error: 'Missing required fields: examId, venueId' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } })
    if (!venue) { res.status(404).json({ error: 'Venue not found' }); return }

    // Ensure pin uniqueness
    let pin: string
    let attempts = 0
    do {
      pin = generatePin()
      attempts++
      if (attempts > 10) { res.status(500).json({ error: 'Could not generate unique PIN' }); return }
    } while (await prisma.materialPin.findUnique({ where: { pin } }))

    const qrCode = `QR-${examId.slice(0, 8)}-${venueId.slice(0, 8)}-${randomUUID().slice(0, 8)}`

    const materialPin = await prisma.materialPin.create({
      data: { examId, venueId, pin, qrCode },
      include: {
        exam: { select: { id: true, examCode: true } },
        venue: { select: { id: true, name: true, cityName: true } },
      },
    })
    res.status(201).json(materialPin)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listPins(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const pins = await prisma.materialPin.findMany({
      where: { examId },
      include: { venue: { select: { id: true, name: true, cityName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(pins)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function confirmMaterial(req: any, res: Response): Promise<void> {
  try {
    const { pin, eventType, quantity, remarks } = req.body
    if (!pin || !eventType) {
      res.status(400).json({ error: 'Missing required fields: pin, eventType' })
      return
    }

    const materialPin = await prisma.materialPin.findUnique({ where: { pin } })
    if (!materialPin) { res.status(404).json({ error: 'PIN not found' }); return }
    if (!materialPin.isActive) { res.status(409).json({ error: 'This PIN is no longer active' }); return }

    // GAP 1: POST_EXAM_DISPATCHED requires EXAM_DAY_SESSION_END checkpoint
    if (eventType === 'POST_EXAM_DISPATCHED') {
      const sessionEnd = await prisma.checkpointSubmission.findFirst({
        where: { examId: materialPin.examId, venueId: materialPin.venueId, type: 'EXAM_DAY_SESSION_END' },
      })
      if (!sessionEnd) {
        res.status(400).json({ error: 'Session must be completed before confirming dispatch.' })
        return
      }
    }

    let discrepancy = false
    if (eventType === 'RECEIVED' && quantity !== undefined) {
      const expectedTotal = materialPin.omrCount + materialPin.salCount + materialPin.stationeryCount
      if (expectedTotal > 0 && quantity !== expectedTotal) {
        discrepancy = true
      }
    }

    const tracking = await prisma.materialTracking.create({
      data: {
        pinId: materialPin.id,
        eventType,
        confirmedBy: req.user.userId,
        quantity: quantity ?? null,
        remarks: remarks ?? null,
        discrepancy,
      },
      include: { confirmer: { select: { id: true, name: true, role: true } } },
    })

    if (discrepancy) {
      const expectedTotal = materialPin.omrCount + materialPin.salCount + materialPin.stationeryCount

      const assignment = await prisma.venueAssignment.findFirst({
        where: { venueId: materialPin.venueId, examId: materialPin.examId },
        include: { cs: { select: { id: true, email: true, name: true } } },
      })

      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: `DISCREPANCY_ALERT: pin=${pin} venueId=${materialPin.venueId} examId=${materialPin.examId} received=${quantity} expected=${expectedTotal}`,
          ipAddress: req.ip,
        },
      })

      if (assignment?.cs?.email) {
        await mailer.sendMail({
          from: 'vms@upsc.gov.in',
          to: assignment.cs.email,
          subject: '[UPSC VMS] ALERT: Material Quantity Discrepancy',
          text: `Dear ${assignment.cs.name},\n\nA material quantity discrepancy has been detected.\n\nPIN: ${pin}\nReceived: ${quantity}\nExpected: ${expectedTotal} (OMR: ${materialPin.omrCount}, SAL: ${materialPin.salCount}, Stationery: ${materialPin.stationeryCount})\n\nPlease investigate immediately.\n\nUPSC VMS`,
        })
      }
    }

    res.status(201).json(tracking)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getTrackingChain(req: any, res: Response): Promise<void> {
  try {
    const { venueId, examId } = req.params
    const pins = await prisma.materialPin.findMany({
      where: { venueId, examId },
      include: {
        trackingEvents: {
          include: { confirmer: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(pins)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getDiscrepancies(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const discrepancies = await prisma.materialTracking.findMany({
      where: {
        discrepancy: true,
        pin: { examId },
      },
      include: {
        pin: { include: { venue: { select: { id: true, name: true, cityName: true } } } },
        confirmer: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(discrepancies)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
