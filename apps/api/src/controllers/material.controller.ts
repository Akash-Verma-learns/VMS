import { Response } from 'express'
import { randomUUID } from 'crypto'
import prisma from '../lib/prisma'

function generatePin(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
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

    const materialPin = await prisma.materialPin.findUnique({
      where: { pin },
      include: { trackingEvents: { orderBy: { createdAt: 'asc' } } },
    })
    if (!materialPin) { res.status(404).json({ error: 'PIN not found' }); return }
    if (!materialPin.isActive) { res.status(409).json({ error: 'This PIN is no longer active' }); return }

    let discrepancy = false
    if (eventType === 'RECEIVED' && quantity !== undefined) {
      const dispatchEvent = materialPin.trackingEvents.find(e => e.eventType === 'DISPATCHED')
      if (dispatchEvent && dispatchEvent.quantity !== null && dispatchEvent.quantity !== quantity) {
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
      console.warn(`[ALERT] Material discrepancy at venueId=${materialPin.venueId} examId=${materialPin.examId} pin=${pin}`)
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
