import { Response } from 'express'
import { runDataQualityChecks, generateClearanceCertificate } from '../services/data-quality.service'

export async function getDataQualityReport(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const report = await runDataQualityChecks(examId)
    if (!report) { res.status(404).json({ error: 'Exam not found' }); return }
    res.json(report)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getClearanceCertificate(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params
    const officerName = typeof req.query.officerName === 'string' && req.query.officerName.trim()
      ? req.query.officerName.trim()
      : (req.user?.email ?? 'Unknown Officer')
    const certificate = await generateClearanceCertificate(examId, officerName)
    if (!certificate) { res.status(404).json({ error: 'Exam not found' }); return }
    res.json(certificate)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
