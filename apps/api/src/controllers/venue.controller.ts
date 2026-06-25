import { Response } from 'express'
import prisma from '../lib/prisma'

export async function createVenue(req: any, res: Response): Promise<void> {
  try {
    const { name, address, cityName, type, capacity } = req.body
    if (!name || !address || !cityName || !type || capacity === undefined) {
      res.status(400).json({ error: 'Missing required fields: name, address, cityName, type, capacity' })
      return
    }

    // CS can only create venues in their own city
    const effectiveCity = req.user.role === 'CS' && req.user.cityName
      ? req.user.cityName
      : cityName

    if (req.user.role === 'CS' && req.user.cityName && cityName !== req.user.cityName) {
      res.status(403).json({ error: `You can only add venues in your assigned city: ${req.user.cityName}` })
      return
    }

    const venue = await prisma.venue.create({
      data: {
        name,
        address,
        cityName: effectiveCity,
        type,
        capacity: Number(capacity),
        addedById: req.user.userId,
        // CS-submitted venues need SO approval; SO/US additions go live immediately
        approvalStatus: req.user.role === 'CS' ? 'PENDING_APPROVAL' : 'APPROVED',
      },
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
    const role: string = req.user.role

    let where: any = {}

    if (role === 'CS') {
      // CS sees only their city's venues (approved or their own pending)
      const csCity = req.user.cityName
      if (csCity) {
        where.cityName = csCity
      }
      where.OR = [
        { approvalStatus: 'APPROVED' },
        { approvalStatus: 'PENDING_APPROVAL', addedById: req.user.userId },
        { approvalStatus: 'REJECTED', addedById: req.user.userId },
      ]
    } else if (role === 'SO' || role === 'US') {
      // SO/US see all cities, can filter; they see all statuses
      if (cityName) where.cityName = String(cityName)
    } else {
      // DS/JS and above: approved venues only
      if (cityName) where.cityName = String(cityName)
      where.approvalStatus = 'APPROVED'
    }

    const venues = await prisma.venue.findMany({
      where,
      include: { addedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(venues)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listPendingVenues(req: any, res: Response): Promise<void> {
  try {
    const venues = await prisma.venue.findMany({
      where: { approvalStatus: 'PENDING_APPROVAL' },
      include: { addedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(venues)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function approveVenue(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const venue = await prisma.venue.findUnique({ where: { id } })
    if (!venue) {
      res.status(404).json({ error: 'Venue not found' })
      return
    }
    if (venue.approvalStatus !== 'PENDING_APPROVAL') {
      res.status(409).json({ error: `Venue is already ${venue.approvalStatus}` })
      return
    }
    const updated = await prisma.venue.update({
      where: { id },
      data: { approvalStatus: 'APPROVED', rejectionNote: null },
      include: { addedBy: { select: { id: true, name: true, role: true } } },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function rejectVenue(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { rejectionNote } = req.body
    if (!rejectionNote?.trim()) {
      res.status(400).json({ error: 'rejectionNote is required when rejecting a venue' })
      return
    }
    const venue = await prisma.venue.findUnique({ where: { id } })
    if (!venue) {
      res.status(404).json({ error: 'Venue not found' })
      return
    }
    const updated = await prisma.venue.update({
      where: { id },
      data: { approvalStatus: 'REJECTED', rejectionNote },
      include: { addedBy: { select: { id: true, name: true, role: true } } },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function createAssignment(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const { venueId, vsId, seatsAllocated } = req.body
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

    if (venue.approvalStatus !== 'APPROVED') {
      res.status(403).json({ error: 'Venue must be approved by SO before it can be assigned to an exam' })
      return
    }

    // CS can only assign venues from their city
    if (req.user.role === 'CS' && req.user.cityName && venue.cityName !== req.user.cityName) {
      res.status(403).json({ error: `You can only assign venues in your city (${req.user.cityName})` })
      return
    }

    const seats = seatsAllocated !== undefined ? Number(seatsAllocated) : null
    if (seats !== null && (seats <= 0 || seats > venue.capacity)) {
      res.status(400).json({ error: `seatsAllocated must be between 1 and venue capacity (${venue.capacity})` })
      return
    }

    const assignment = await prisma.venueAssignment.create({
      data: {
        examId,
        venueId,
        vsId: vsId ?? null,
        csId: req.user.userId,
        seatsAllocated: seats,
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
    const role: string = req.user.role

    const where: any = { examId }
    // CS only sees their own assignments
    if (role === 'CS') where.csId = req.user.userId

    const assignments = await prisma.venueAssignment.findMany({
      where,
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
    const { status, rejectionComment } = req.body
    const role: string = req.user.role

    const allowedByRole: Record<string, string[]> = {
      SO: ['SO_REVIEWED', 'REJECTED'],
      US: ['APPROVED', 'REJECTED'],
    }

    if (!allowedByRole[role]?.includes(status)) {
      res.status(403).json({ error: `Role ${role} cannot set assignment status to ${status}` })
      return
    }

    if (status === 'REJECTED' && !rejectionComment?.trim()) {
      res.status(400).json({ error: 'rejectionComment is required when rejecting an assignment' })
      return
    }

    const assignment = await prisma.venueAssignment.findUnique({ where: { id: assignmentId } })
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' })
      return
    }

    const data: any = { status }
    if (status === 'APPROVED') data.approvedAt = new Date()
    if (status === 'REJECTED') data.rejectionComment = rejectionComment

    const updated = await prisma.venueAssignment.update({
      where: { id: assignmentId },
      data,
      include: {
        venue: true,
        vs: { select: { id: true, name: true, role: true } },
        cs: { select: { id: true, name: true, role: true } },
      },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getMyAssignments(req: any, res: Response): Promise<void> {
  try {
    const assignments = await prisma.venueAssignment.findMany({
      where: { csId: req.user.userId },
      include: {
        venue: { select: { id: true, name: true, cityName: true, capacity: true } },
        exam: { select: { id: true, name: true, examCode: true } },
        vs: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(assignments)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function submitAssignments(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const result = await prisma.venueAssignment.updateMany({
      where: { examId, csId: req.user.userId, status: 'PROPOSED' },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    })
    res.json({ message: 'Assignments submitted for UPSC review', count: result.count })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
