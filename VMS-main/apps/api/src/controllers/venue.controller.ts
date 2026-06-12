import { Response } from 'express'
import prisma from '../lib/prisma'

export async function createVenue(req: any, res: Response): Promise<void> {
  try {
    const { name, address, cityName, type, capacity } = req.body
    if (!name || !address || !cityName || !type || capacity === undefined) {
      res.status(400).json({ error: 'Missing required fields: name, address, cityName, type, capacity' })
      return
    }

    const venue = await prisma.venue.create({
      data: { name, address, cityName, type, capacity: Number(capacity), addedById: req.user.userId },
      include: { addedBy: { select: { id: true, name: true, role: true } } },
    })
    res.status(201).json(venue)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listVenues(req: any, res: Response): Promise<void> {
  try {
    const { cityName } = req.query
    const venues = await prisma.venue.findMany({
      where: cityName ? { cityName: String(cityName) } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    res.json(venues)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function createAssignment(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const { venueId, vsId } = req.body
    if (!venueId) {
      res.status(400).json({ error: 'venueId is required' })
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

    const assignment = await prisma.venueAssignment.create({
      data: {
        examId,
        venueId,
        vsId: vsId ?? null,
        csId: req.user.userId,
      },
      include: {
        venue: true,
        vs: { select: { id: true, name: true, role: true } },
        cs: { select: { id: true, name: true, role: true } },
      },
    })
    res.status(201).json(assignment)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listAssignments(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const assignments = await prisma.venueAssignment.findMany({
      where: { examId },
      include: {
        venue: true,
        vs: { select: { id: true, name: true, role: true } },
        cs: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(assignments)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function updateAssignment(req: any, res: Response): Promise<void> {
  try {
    const { assignmentId } = req.params
    const { status } = req.body
    const role: string = req.user.role

    const allowedByRole: Record<string, string[]> = {
      SO: ['SO_REVIEWED'],
      US: ['APPROVED', 'REJECTED'],
    }

    if (!allowedByRole[role]?.includes(status)) {
      res.status(403).json({ error: `Role ${role} cannot set assignment status to ${status}` })
      return
    }

    const assignment = await prisma.venueAssignment.findUnique({ where: { id: assignmentId } })
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' })
      return
    }

    const data: any = { status }
    if (status === 'APPROVED') data.approvedAt = new Date()

    const updated = await prisma.venueAssignment.update({
      where: { id: assignmentId },
      data,
      include: { venue: true, vs: { select: { id: true, name: true, role: true } }, cs: { select: { id: true, name: true, role: true } } },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function submitAssignments(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const result = await prisma.venueAssignment.updateMany({
      where: { examId, status: 'PROPOSED' },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    })
    res.json({ message: 'Assignments submitted for UPSC review', count: result.count })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
