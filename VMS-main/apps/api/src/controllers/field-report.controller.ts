import { Response } from 'express'
import prisma from '../lib/prisma'

export async function syncReports(req: any, res: Response): Promise<void> {
  try {
    const { reports } = req.body
    if (!Array.isArray(reports)) {
      res.status(400).json({ error: 'Expected an array of reports' })
      return
    }

    const results = []
    
    for (const report of reports) {
      // Check for idempotency
      const existing = await prisma.fieldReport.findUnique({
        where: { id: report.id }
      })

      if (existing) {
        results.push({ id: report.id, status: 'already_exists' })
        continue
      }

      // Create new report
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
    const { venueId, batteryLevel, queueSize } = req.body
    console.log(`[HEARTBEAT] VS: ${req.user.userId} | Venue: ${venueId} | Battery: ${batteryLevel}% | Queue: ${queueSize}`)
    res.status(200).json({ message: 'Heartbeat received' })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
