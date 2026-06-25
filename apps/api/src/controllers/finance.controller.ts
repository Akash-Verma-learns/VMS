import { Response } from 'express'
import prisma from '../lib/prisma'

export async function computeAdvance(req: any, res: Response): Promise<void> {
  try {
    const { examId, venueId, candidateCount } = req.body
    if (!examId || !venueId || candidateCount === undefined) {
      res.status(400).json({ error: 'Missing required fields: examId, venueId, candidateCount' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } })
    if (!venue) {
      res.status(404).json({ error: 'Venue not found' })
      return
    }

    const count = BigInt(candidateCount)
    const honorarium = count * BigInt(500) * BigInt(100)
    const stationery = count * BigInt(50) * BigInt(100)
    const contingency = BigInt(500000) * BigInt(100)
    const totalAmount = honorarium + stationery + contingency

    const calc = await prisma.advanceCalculation.create({
      data: {
        examId,
        venueId,
        candidateCount: Number(candidateCount),
        honorarium,
        stationery,
        contingency,
        totalAmount,
        computedById: req.user.userId,
      },
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        venue: { select: { id: true, name: true, cityName: true } },
        computedBy: { select: { id: true, name: true, role: true } },
      },
    })
    res.status(201).json(calc)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listCalculations(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const calculations = await prisma.advanceCalculation.findMany({
      where: { examId },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        computedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { computedAt: 'desc' },
    })
    res.json(calculations)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

const VALID_BILL_TYPES = ['HONORARIUM', 'STATIONERY', 'CONTINGENCY', 'TRANSPORT', 'ACCOMMODATION', 'OTHER']
const MAX_BILL_AMOUNT_PAISE = BigInt(5_00_00_000_00) // ₹5 crore cap

export async function submitBill(req: any, res: Response): Promise<void> {
  try {
    const { examId, amount, type, documentUrl } = req.body
    if (!examId || amount === undefined || !type) {
      res.status(400).json({ error: 'Missing required fields: examId, amount (in paise), type' })
      return
    }

    if (!VALID_BILL_TYPES.includes(type)) {
      res.status(400).json({ error: `Invalid bill type. Must be one of: ${VALID_BILL_TYPES.join(', ')}` })
      return
    }

    let amountPaise: bigint
    try {
      amountPaise = BigInt(amount)
    } catch {
      res.status(400).json({ error: 'amount must be a valid integer (paise)' })
      return
    }
    if (amountPaise <= BigInt(0)) {
      res.status(400).json({ error: 'amount must be greater than 0' })
      return
    }
    if (amountPaise > MAX_BILL_AMOUNT_PAISE) {
      res.status(400).json({ error: 'amount exceeds maximum allowed (₹5 crore)' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }

    const bill = await prisma.bill.create({
      data: {
        examId,
        submittedBy: req.user.userId,
        amount: amountPaise,
        type,
        documentUrl: documentUrl ?? null,
      },
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        submitter: { select: { id: true, name: true, role: true } },
      },
    })
    res.status(201).json(bill)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listBills(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const bills = await prisma.bill.findMany({
      where: { examId },
      include: {
        submitter: { select: { id: true, name: true, role: true } },
        verifier: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(bills)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function verifyBill(req: any, res: Response): Promise<void> {
  try {
    const bill = await prisma.bill.findUnique({ where: { id: req.params.billId } })
    if (!bill) {
      res.status(404).json({ error: 'Bill not found' })
      return
    }
    if (bill.status !== 'SUBMITTED') {
      res.status(409).json({ error: `Bill cannot be verified from status '${bill.status}'. It must be SUBMITTED.` })
      return
    }

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'VERIFIED', verifiedBy: req.user.userId, verifiedAt: new Date() },
      include: { submitter: { select: { id: true, name: true, role: true } } },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `BILL_VERIFIED billId=${bill.id} examId=${bill.examId} amount=${bill.amount}`,
        ipAddress: req.ip,
      },
    })

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function approveBill(req: any, res: Response): Promise<void> {
  try {
    const bill = await prisma.bill.findUnique({ where: { id: req.params.billId } })
    if (!bill) {
      res.status(404).json({ error: 'Bill not found' })
      return
    }
    if (bill.status !== 'VERIFIED') {
      res.status(409).json({ error: `Bill cannot be approved from status '${bill.status}'. It must be VERIFIED first.` })
      return
    }

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'APPROVED' },
      include: { submitter: { select: { id: true, name: true, role: true } } },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `BILL_APPROVED billId=${bill.id} examId=${bill.examId} amount=${bill.amount}`,
        ipAddress: req.ip,
      },
    })

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
