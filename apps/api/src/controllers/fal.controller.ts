import { Response } from 'express'
import { randomInt } from 'crypto'
import prisma from '../lib/prisma'

const MAX_FAL_AMOUNT_PAISE = BigInt(5_00_00_000_00) // ₹5 crore cap

// Race-condition-safe: appends a random suffix so concurrent creates don't collide on @unique falNumber
async function generateFalNumber(year: number): Promise<string> {
  const count = await prisma.fAL.count({ where: { exam: { year } } })
  const suffix = String(randomInt(100, 999))
  return `FAL/${year}/${String(count + 1).padStart(4, '0')}-${suffix}`
}

export async function createFAL(req: any, res: Response): Promise<void> {
  try {
    const { examId, csId, advanceAmountInPaise } = req.body
    if (!examId || !csId || advanceAmountInPaise === undefined) {
      res.status(400).json({ error: 'Missing required fields: examId, csId, advanceAmountInPaise' })
      return
    }

    let amountPaise: bigint
    try {
      amountPaise = BigInt(advanceAmountInPaise)
    } catch {
      res.status(400).json({ error: 'advanceAmountInPaise must be a valid integer' })
      return
    }
    if (amountPaise <= BigInt(0)) {
      res.status(400).json({ error: 'advanceAmountInPaise must be greater than 0' })
      return
    }
    if (amountPaise > MAX_FAL_AMOUNT_PAISE) {
      res.status(400).json({ error: 'Advance amount exceeds maximum allowed (₹5 crore)' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }

    const cs = await prisma.user.findUnique({ where: { id: csId } })
    if (!cs) {
      res.status(404).json({ error: 'CS user not found' })
      return
    }

    const falNumber = await generateFalNumber(exam.year)

    const fal = await prisma.fAL.create({
      data: {
        examId,
        csId,
        falNumber,
        advanceAmount: amountPaise,
        status: 'PENDING_DS',
      },
      include: {
        exam: { select: { id: true, name: true, examCode: true, year: true } },
        cs: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    res.status(201).json(fal)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listFALs(_req: any, res: Response): Promise<void> {
  try {
    const fals = await prisma.fAL.findMany({
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        cs: { select: { id: true, name: true, role: true } },
        sanctionedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(fals)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getFAL(req: any, res: Response): Promise<void> {
  try {
    const fal = await prisma.fAL.findUnique({
      where: { id: req.params.id },
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        cs: { select: { id: true, name: true, role: true } },
        sanctionedBy: { select: { id: true, name: true, role: true } },
        reminders: { orderBy: { sentAt: 'asc' } },
      },
    })
    if (!fal) {
      res.status(404).json({ error: 'FAL not found' })
      return
    }
    res.json(fal)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function sanctionFAL(req: any, res: Response): Promise<void> {
  try {
    const fal = await prisma.fAL.findUnique({ where: { id: req.params.id } })
    if (!fal) {
      res.status(404).json({ error: 'FAL not found' })
      return
    }
    if (fal.status !== 'PENDING_DS') {
      res.status(409).json({ error: `FAL cannot be sanctioned from status ${fal.status}` })
      return
    }

    const updated = await prisma.fAL.update({
      where: { id: fal.id },
      data: { status: 'SANCTIONED', sanctionedById: req.user.userId },
      include: { cs: { select: { id: true, name: true, role: true } } },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `FAL_SANCTIONED falId=${fal.id} falNumber=${fal.falNumber} amount=${fal.advanceAmount}`,
        ipAddress: req.ip,
      },
    })

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function acknowledgeFAL(req: any, res: Response): Promise<void> {
  try {
    const fal = await prisma.fAL.findUnique({ where: { id: req.params.id } })
    if (!fal) {
      res.status(404).json({ error: 'FAL not found' })
      return
    }

    if (fal.csId !== req.user.userId) {
      res.status(403).json({ error: 'Only the assigned CS can acknowledge this FAL' })
      return
    }

    const updated = await prisma.fAL.update({
      where: { id: fal.id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function createReminder(req: any, res: Response): Promise<void> {
  try {
    const { type } = req.body
    if (!type) {
      res.status(400).json({ error: 'type is required' })
      return
    }

    const fal = await prisma.fAL.findUnique({ where: { id: req.params.id } })
    if (!fal) {
      res.status(404).json({ error: 'FAL not found' })
      return
    }

    const reminder = await prisma.fALReminder.create({
      data: { falId: fal.id, type },
    })
    res.status(201).json(reminder)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
