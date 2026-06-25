import { Request, Response } from 'express'
import prisma from '../lib/prisma'

export async function submitPreference(req: Request, res: Response): Promise<void> {
  try {
    const { examCode, rollNo, candidateName, priority1, priority2, priority3, priority4, priority5 } = req.body

    if (!examCode || !rollNo || !priority1) {
      res.status(400).json({ error: 'examCode, rollNo, and priority1 are required' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { examCode: String(examCode) } })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found. Please check the exam code.' })
      return
    }

    const preference = await prisma.candidatePreference.upsert({
      where: { examId_rollNo: { examId: exam.id, rollNo: String(rollNo) } },
      update: {
        candidateName: candidateName ?? null,
        priority1,
        priority2: priority2 ?? null,
        priority3: priority3 ?? null,
        priority4: priority4 ?? null,
        priority5: priority5 ?? null,
      },
      create: {
        examId: exam.id,
        rollNo: String(rollNo),
        candidateName: candidateName ?? null,
        priority1,
        priority2: priority2 ?? null,
        priority3: priority3 ?? null,
        priority4: priority4 ?? null,
        priority5: priority5 ?? null,
      },
    })
    res.status(201).json({ message: 'Preferences saved successfully', preference })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listPreferences(req: any, res: Response): Promise<void> {
  try {
    const { examId, examCode, rollNo } = req.query

    let resolvedExamId = examId as string | undefined

    if (!resolvedExamId && examCode) {
      const exam = await prisma.exam.findUnique({ where: { examCode: String(examCode) } })
      if (!exam) {
        res.status(404).json({ error: 'Exam not found' })
        return
      }
      resolvedExamId = exam.id
    }

    if (!resolvedExamId) {
      res.status(400).json({ error: 'examId or examCode is required' })
      return
    }

    const where: any = { examId: resolvedExamId }
    if (rollNo) where.rollNo = String(rollNo)

    const preferences = await prisma.candidatePreference.findMany({
      where,
      include: { exam: { select: { id: true, name: true, examCode: true } } },
      orderBy: { rollNo: 'asc' },
    })
    res.json(preferences)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getExamCities(req: Request, res: Response): Promise<void> {
  try {
    const code = req.query.code ?? req.params.examCode
    if (!code) {
      res.status(400).json({ error: 'code query param is required' })
      return
    }
    const examCode = String(code).trim().toUpperCase()
    const exam = await prisma.exam.findUnique({
      where: { examCode },
      include: { centres: { select: { cityName: true, finalCapacity: true, suggestedCapacity: true } } },
    })
    if (!exam) {
      res.status(404).json({ error: `Exam "${examCode}" not found. Please check the exam code.` })
      return
    }
    const cities = exam.centres.map((c) => c.cityName)
    res.json({ examCode: exam.examCode, examName: exam.name, cities })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getPreferenceSummary(req: any, res: Response): Promise<void> {
  try {
    const { examId, examCode } = req.query

    let resolvedExamId = examId as string | undefined
    if (!resolvedExamId && examCode) {
      const exam = await prisma.exam.findUnique({ where: { examCode: String(examCode) } })
      if (!exam) {
        res.status(404).json({ error: 'Exam not found' })
        return
      }
      resolvedExamId = exam.id
    }

    if (!resolvedExamId) {
      res.status(400).json({ error: 'examId or examCode is required' })
      return
    }

    // Aggregate city demand across all priority levels
    const prefs = await prisma.candidatePreference.findMany({
      where: { examId: resolvedExamId },
      select: { priority1: true, priority2: true, priority3: true, priority4: true, priority5: true },
    })

    const cityCount: Record<string, { p1: number; p2: number; p3: number; p4: number; p5: number; total: number }> = {}
    for (const p of prefs) {
      const cities = [p.priority1, p.priority2, p.priority3, p.priority4, p.priority5]
      cities.forEach((city, idx) => {
        if (!city) return
        if (!cityCount[city]) cityCount[city] = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, total: 0 }
        const key = `p${idx + 1}` as keyof typeof cityCount[string]
        cityCount[city][key]++
        cityCount[city].total++
      })
    }

    res.json({
      totalCandidates: prefs.length,
      cityDemand: Object.entries(cityCount)
        .map(([city, counts]) => ({ city, ...counts }))
        .sort((a, b) => b.p1 - a.p1),
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
