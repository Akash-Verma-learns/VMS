import { Response } from 'express'
import prisma from '../lib/prisma'

export async function createApproval(req: any, res: Response): Promise<void> {
  try {
    const { examId, type, currentRole, dueAt } = req.body
    if (!examId || !type || !currentRole || !dueAt) {
      res.status(400).json({ error: 'Missing required fields: examId, type, currentRole, dueAt' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }

    const approval = await prisma.approvalRequest.create({
      data: {
        examId,
        type,
        currentRole,
        dueAt: new Date(dueAt),
        initiatedBy: req.user.userId,
      },
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        initiator: { select: { id: true, name: true, role: true } },
      },
    })
    res.status(201).json(approval)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listApprovals(req: any, res: Response): Promise<void> {
  try {
    const approvals = await prisma.approvalRequest.findMany({
      where: { currentRole: req.user.role },
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        initiator: { select: { id: true, name: true, role: true } },
        auditEntries: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(approvals)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function actionApproval(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { action, remarks } = req.body

    if (!action || !['APPROVE', 'REJECT', 'ESCALATE'].includes(action)) {
      res.status(400).json({ error: 'Invalid action. Must be APPROVE, REJECT, or ESCALATE' })
      return
    }

    const approval = await prisma.approvalRequest.findUnique({ where: { id } })
    if (!approval) {
      res.status(404).json({ error: 'Approval request not found' })
      return
    }

    // Idempotency: prevent duplicate actions from same actor at same stage
    const existing = await prisma.approvalAudit.findFirst({
      where: { requestId: id, actorId: req.user.userId, action },
    })
    if (existing) {
      res.status(409).json({ error: 'You have already performed this action on this request' })
      return
    }

    const statusMap: Record<string, string> = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      ESCALATE: 'ESCALATED',
    }

    await prisma.approvalAudit.create({
      data: { requestId: id, actorId: req.user.userId, action, remarks: remarks ?? null },
    })

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: { status: statusMap[action] as any },
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        auditEntries: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
