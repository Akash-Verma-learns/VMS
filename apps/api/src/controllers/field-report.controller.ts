import { Response } from 'express'
import prisma from '../lib/prisma'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUUIDv4(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s)
}

export async function syncReports(req: any, res: Response): Promise<void> {
  try {
    const { reports } = req.body
    if (!Array.isArray(reports)) {
      res.status(400).json({ error: 'Expected an array of reports' })
      return
    }

    const results = []

    for (const report of reports) {
      if (!isUUIDv4(report.id)) {
        results.push({ id: report.id, status: 'rejected', reason: 'id must be a valid UUID v4' })
        continue
      }

      const existing = await prisma.fieldReport.findUnique({ where: { id: report.id } })
      if (existing) {
        results.push({ id: report.id, status: 'already_exists' })
        continue
      }

      await prisma.fieldReport.create({
        data: {
          id: report.id,
          venueId: report.venueId,
          submittedBy: req.user.userId,
          isDrill: report.isDrill || false,
          reportType: report.reportType,
          data: report.data,
          deviceTime: new Date(report.deviceTime),
        }
      })
      results.push({ id: report.id, status: 'created' })
    }

    res.status(200).json({ message: 'Sync complete', results })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function heartbeat(req: any, res: Response): Promise<void> {
  try {
    const { venueId, batteryLevel, queueSize, examId } = req.body

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `HEARTBEAT venueId=${venueId ?? 'unknown'} examId=${examId ?? 'unknown'} battery=${batteryLevel ?? '?'}% queue=${queueSize ?? '?'}`,
        ipAddress: req.ip,
      },
    })

    res.status(200).json({ message: 'Heartbeat received' })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
