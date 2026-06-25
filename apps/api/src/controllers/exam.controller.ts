import { Response } from 'express'
import prisma from '../lib/prisma'
import { getSuggestedCapacity, generateExamCode } from '../services/exam.service'

export async function createExam(req: any, res: Response): Promise<void> {
  try {
    const { name, year, examType, scheduledDate, sessions, session1Start, session1End, session2Start, session2End, cities } = req.body

    const missing = []
    if (!name) missing.push('name')
    if (!year) missing.push('year')
    if (!examType) missing.push('examType')
    if (!scheduledDate) missing.push('scheduledDate')
    if (!Array.isArray(cities) || cities.length === 0) missing.push('cities (at least one)')
    if (missing.length > 0) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
      return
    }

    const examCode = generateExamCode(Number(year), examType)

    const exam = await prisma.exam.create({
      data: {
        name,
        examCode,
        year: Number(year),
        examType,
        scheduledDate: new Date(scheduledDate),
        sessions: sessions ?? 1,
        session1Start: session1Start ?? null,
        session1End: session1End ?? null,
        session2Start: session2Start ?? null,
        session2End: session2End ?? null,
        createdById: req.user.userId,
        centres: {
          create: cities.map((cityName: string) => ({
            cityName,
            suggestedCapacity: getSuggestedCapacity(cityName),
          })),
        },
      },
      include: { centres: true, createdBy: { select: { id: true, name: true, email: true, role: true } } },
    })

    res.status(201).json(exam)
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'An exam with this code already exists for this year and type' })
      return
    }
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function lookupExamByCode(req: any, res: Response): Promise<void> {
  try {
    const code = String(req.query.code ?? '').trim().toUpperCase()
    if (!code) { res.status(400).json({ error: 'code query param is required' }); return }
    const exam = await prisma.exam.findUnique({
      where: { examCode: code },
      select: { id: true, name: true, examCode: true, status: true, scheduledDate: true,
                centres: { select: { cityName: true } } },
    })
    if (!exam) { res.status(404).json({ error: `Exam "${code}" not found. Check the exam code and try again.` }); return }
    if (exam.status !== 'RELEASED') {
      res.status(403).json({ error: `Exam "${code}" has not been released yet. Contact your SO.` }); return
    }
    res.json({ id: exam.id, name: exam.name, examCode: exam.examCode, status: exam.status,
               scheduledDate: exam.scheduledDate, cities: exam.centres.map(c => c.cityName) })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listExams(_req: any, res: Response): Promise<void> {
  try {
    const exams = await prisma.exam.findMany({
      include: { centres: true, createdBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(exams)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getExam(req: any, res: Response): Promise<void> {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: { centres: true, createdBy: { select: { id: true, name: true, role: true } } },
    })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }
    res.json(exam)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function releaseExam(req: any, res: Response): Promise<void> {
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }

    const now = new Date()
    await prisma.centre.updateMany({
      where: { examId: exam.id },
      data: { isReleased: true, releasedAt: now },
    })

    const updated = await prisma.exam.update({
      where: { id: exam.id },
      data: { status: 'RELEASED' },
      include: { centres: true },
    })

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function updateCentre(req: any, res: Response): Promise<void> {
  try {
    const { finalCapacity } = req.body
    if (finalCapacity === undefined) {
      res.status(400).json({ error: 'finalCapacity is required' })
      return
    }

    const centre = await prisma.centre.findFirst({
      where: { id: req.params.centreId, examId: req.params.id },
    })
    if (!centre) {
      res.status(404).json({ error: 'Centre not found for this exam' })
      return
    }

    const updated = await prisma.centre.update({
      where: { id: centre.id },
      data: { finalCapacity: Number(finalCapacity) },
    })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
