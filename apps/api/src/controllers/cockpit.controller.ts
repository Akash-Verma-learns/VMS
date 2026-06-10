import { Response } from 'express'
import prisma from '../lib/prisma'
import { mailer } from '../lib/mailer'

export async function getExamStatus(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return }

    // READ REPLICA QUERY
    const [
      totalVenues,
      checkpointsSubmitted,
      readinessDone,
      pendingApprovals,
      assignedVenueIds,
      reportingVenueIds,
    ] = await Promise.all([
      // READ REPLICA QUERY
      prisma.venueAssignment.count({ where: { examId } }),
      // READ REPLICA QUERY
      prisma.checkpointSubmission.count({ where: { examId } }),
      // READ REPLICA QUERY
      prisma.venueReadiness.count({ where: { examId, status: { in: ['SUBMITTED', 'REVIEWED'] } } }),
      // READ REPLICA QUERY
      prisma.approvalRequest.count({ where: { examId, status: { in: ['PENDING', 'IN_REVIEW'] } } }),
      // READ REPLICA QUERY
      prisma.venueAssignment.findMany({ where: { examId }, select: { venueId: true } }),
      // READ REPLICA QUERY
      prisma.checkpointSubmission.findMany({ where: { examId }, select: { venueId: true }, distinct: ['venueId'] }),
    ])

    // READ REPLICA QUERY
    const materialsConfirmed = await prisma.materialTracking.count({
      where: { eventType: 'CONFIRMED', pin: { examId } },
    })

    const assignedIds = assignedVenueIds.map(a => a.venueId)
    const reportingIds = new Set(reportingVenueIds.map(r => r.venueId))
    const nonReportingCount = assignedIds.filter(id => !reportingIds.has(id)).length

    res.json({
      examId,
      examCode: exam.examCode,
      examStatus: exam.status,
      totalVenues,
      checkpointsSubmitted,
      readinessDone,
      materialsConfirmed,
      pendingApprovals,
      nonReportingVenues: nonReportingCount,
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getTeamWorkload(req: any, res: Response): Promise<void> {
  try {
    const role: string = req.user.role

    // READ REPLICA QUERY
    const approvalWhereClause: any = { status: { in: ['PENDING', 'IN_REVIEW'] } }
    if (role === 'US') {
      approvalWhereClause.currentRole = { in: ['SO', 'ASO'] }
    }

    // READ REPLICA QUERY
    const [pendingApprovals, pendingFALs, pendingBills, overdueApprovals] = await Promise.all([
      prisma.approvalRequest.groupBy({
        by: ['currentRole'],
        where: approvalWhereClause,
        _count: { id: true },
      }),
      // READ REPLICA QUERY
      prisma.fAL.count({ where: { status: 'PENDING_DS' } }),
      // READ REPLICA QUERY
      prisma.bill.count({ where: { status: 'SUBMITTED' } }),
      // READ REPLICA QUERY
      prisma.approvalRequest.count({
        where: { ...approvalWhereClause, dueAt: { lt: new Date() } },
      }),
    ])

    res.json({
      pendingApprovalsByRole: pendingApprovals.map(p => ({ role: p.currentRole, count: p._count.id })),
      pendingFALsForDS: pendingFALs,
      pendingBillsForVerification: pendingBills,
      overdueApprovals,
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getAlerts(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const now = new Date()

    // READ REPLICA QUERY
    const [overdueReadiness, materialDiscrepancies, overdueApprovals, assignedVenueIds, reportingVenueIds] =
      await Promise.all([
        // READ REPLICA QUERY
        prisma.venueReadiness.findMany({
          where: { examId, status: 'PENDING', submittedAt: null },
          include: { venue: { select: { id: true, name: true, cityName: true } } },
        }),
        // READ REPLICA QUERY
        prisma.materialTracking.findMany({
          where: { discrepancy: true, pin: { examId } },
          include: { pin: { include: { venue: { select: { id: true, name: true, cityName: true } } } } },
        }),
        // READ REPLICA QUERY
        prisma.approvalRequest.findMany({
          where: { examId, status: { in: ['PENDING', 'IN_REVIEW'] }, dueAt: { lt: now } },
          include: { initiator: { select: { id: true, name: true } } },
        }),
        // READ REPLICA QUERY
        prisma.venueAssignment.findMany({ where: { examId }, select: { venueId: true } }),
        // READ REPLICA QUERY
        prisma.checkpointSubmission.findMany({ where: { examId }, select: { venueId: true }, distinct: ['venueId'] }),
      ])

    const assignedIds = assignedVenueIds.map(a => a.venueId)
    const reportingIds = new Set(reportingVenueIds.map(r => r.venueId))
    const nonReportingVenueIds = assignedIds.filter(id => !reportingIds.has(id))

    // READ REPLICA QUERY
    const nonReportingVenues = nonReportingVenueIds.length > 0
      ? await prisma.venue.findMany({
          where: { id: { in: nonReportingVenueIds } },
          select: { id: true, name: true, cityName: true },
        })
      : []

    res.json({
      overdueReadiness: overdueReadiness.map(r => ({ venueId: r.venueId, venue: r.venue })),
      materialDiscrepancies: materialDiscrepancies.map(d => ({ pinId: d.pinId, venue: d.pin.venue })),
      nonReportingVenues,
      overdueApprovals: overdueApprovals.map(a => ({ id: a.id, type: a.type, dueAt: a.dueAt })),
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function sendNotification(req: any, res: Response): Promise<void> {
  try {
    const { targetUserId, message, examId } = req.body
    if (!targetUserId || !message) {
      res.status(400).json({ error: 'Missing required fields: targetUserId, message' })
      return
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!targetUser) { res.status(404).json({ error: 'Target user not found' }); return }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `PRIORITY_NOTIFICATION to ${targetUser.email}${examId ? ` [exam:${examId}]` : ''}: ${message}`,
        ipAddress: req.ip,
      },
    })

    await mailer.sendMail({
      from: 'vms@upsc.gov.in',
      to: targetUser.email,
      subject: '[UPSC VMS] Priority Notification',
      text: message,
    })

    res.json({ sent: true, to: targetUser.email })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function getAttendanceReport(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    // READ REPLICA QUERY
    const submissions = await prisma.checkpointSubmission.findMany({
      where: { examId, type: 'EXAM_DAY_ATTENDANCE' },
      include: { venue: { select: { id: true, name: true, cityName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ examId, count: submissions.length, records: submissions })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getFinancialReport(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    // READ REPLICA QUERY
    const [fals, bills] = await Promise.all([
      prisma.fAL.findMany({
        where: { examId },
        include: { cs: { select: { id: true, name: true, email: true } } },
      }),
      prisma.bill.findMany({
        where: { examId },
        include: { submitter: { select: { id: true, name: true, role: true } } },
      }),
    ])

    const byCs: Record<string, any> = {}
    for (const fal of fals) {
      byCs[fal.csId] = {
        cs: fal.cs,
        advanceIssued: fal.advanceAmount.toString(),
        falStatus: fal.status,
        billsSubmitted: BigInt(0),
        billsApproved: BigInt(0),
      }
    }
    for (const bill of bills) {
      if (!byCs[bill.submittedBy]) {
        byCs[bill.submittedBy] = {
          cs: bill.submitter,
          advanceIssued: '0',
          falStatus: null,
          billsSubmitted: BigInt(0),
          billsApproved: BigInt(0),
        }
      }
      byCs[bill.submittedBy].billsSubmitted += bill.amount
      if (bill.status === 'APPROVED') byCs[bill.submittedBy].billsApproved += bill.amount
    }

    const summary = Object.values(byCs).map((entry: any) => ({
      ...entry,
      billsSubmitted: entry.billsSubmitted.toString(),
      billsApproved: entry.billsApproved.toString(),
    }))

    res.json({ examId, summary })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getVenueStatusReport(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    // READ REPLICA QUERY
    const readiness = await prisma.venueReadiness.findMany({
      where: { examId },
      include: { venue: { select: { id: true, name: true, cityName: true } } },
    })

    const byCity: Record<string, { total: number; submitted: number; reviewed: number; flagged: number }> = {}
    for (const r of readiness) {
      const city = r.venue.cityName
      if (!byCity[city]) byCity[city] = { total: 0, submitted: 0, reviewed: 0, flagged: 0 }
      byCity[city].total++
      if (r.status === 'SUBMITTED') byCity[city].submitted++
      if (r.status === 'REVIEWED') byCity[city].reviewed++
      if (r.status === 'FLAGGED') byCity[city].flagged++
    }

    res.json({ examId, cities: byCity })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getInspectionSummary(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    // READ REPLICA QUERY
    const inspections = await prisma.inspection.findMany({
      where: { examId },
      include: { venue: { select: { id: true, name: true, cityName: true } } },
    })

    const summary = {
      total: inspections.length,
      assigned: inspections.filter(i => i.status === 'ASSIGNED').length,
      submitted: inspections.filter(i => i.status === 'SUBMITTED').length,
      reviewed: inspections.filter(i => i.status === 'REVIEWED').length,
      remediationRequired: inspections.filter(i => i.status === 'REMEDIATION_REQUIRED').length,
      withFindings: inspections.filter(i => i.findings).length,
      byVenue: inspections.map(i => ({
        venueId: i.venueId,
        venue: i.venue,
        status: i.status,
        requiresRemediation: i.requiresRemediation,
        findings: i.findings,
      })),
    }

    res.json({ examId, ...summary })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getMaterialTrackingReport(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    // READ REPLICA QUERY
    const pins = await prisma.materialPin.findMany({
      where: { examId },
      include: {
        venue: { select: { id: true, name: true, cityName: true } },
        trackingEvents: {
          orderBy: { createdAt: 'asc' },
          include: { confirmer: { select: { id: true, name: true, role: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const summary = pins.map(p => ({
      pin: p.pin,
      venue: p.venue,
      dispatched: p.trackingEvents.some(e => e.eventType === 'DISPATCHED'),
      received: p.trackingEvents.some(e => e.eventType === 'RECEIVED'),
      hasDiscrepancy: p.trackingEvents.some(e => e.discrepancy),
      confirmed: p.trackingEvents.some(e => e.eventType === 'CONFIRMED'),
      eventCount: p.trackingEvents.length,
    }))

    res.json({ examId, total: pins.length, summary })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
