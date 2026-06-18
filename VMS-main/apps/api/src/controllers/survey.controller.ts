import { Response } from 'express'
import prisma from '../lib/prisma'
import { publishSurvey as publishSurveyService, buildResponseSummary } from '../services/survey.service'

export async function createSurvey(req: any, res: Response): Promise<void> {
  try {
    const { title, description, examId, questions, dueAt } = req.body
    if (!title) {
      res.status(400).json({ error: 'title is required' })
      return
    }

    const survey = await prisma.survey.create({
      data: {
        title,
        description: description ?? null,
        examId: examId ?? null,
        createdById: req.user.userId,
        dueAt: dueAt ? new Date(dueAt) : null,
        questions: {
          create: Array.isArray(questions)
            ? questions.map((q: any) => ({
                order: q.order,
                text: q.text,
                type: q.type,
                options: q.options ?? null,
                required: q.required ?? true,
              }))
            : [],
        },
      },
      include: {
        questions: { orderBy: { order: 'asc' } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    })

    res.status(201).json(survey)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function publishSurvey(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { recipientFilter } = req.body

    const survey = await prisma.survey.findUnique({ where: { id } })
    if (!survey) {
      res.status(404).json({ error: 'Survey not found' })
      return
    }

    if (survey.status !== 'DRAFT') {
      res.status(400).json({ error: 'Survey is already published or closed' })
      return
    }

    if (!recipientFilter) {
      res.status(400).json({ error: 'recipientFilter is required' })
      return
    }

    const distributed = await publishSurveyService(id, recipientFilter)
    res.json({ distributed })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listMySurveys(req: any, res: Response): Promise<void> {
  try {
    const distributions = await prisma.surveyDistribution.findMany({
      where: { userId: req.user.userId },
      include: {
        survey: {
          include: {
            questions: { orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Check which surveys user has already responded to
    const surveyIds = distributions.map(d => d.surveyId)
    const myResponses = await prisma.surveyResponse.findMany({
      where: { userId: req.user.userId, surveyId: { in: surveyIds } },
      select: { surveyId: true },
    })
    const respondedIds = new Set(myResponses.map(r => r.surveyId))

    const surveys = distributions.map(d => ({
      ...d.survey,
      responded: respondedIds.has(d.surveyId),
    }))

    res.json(surveys)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getSurveyDetails(req: any, res: Response): Promise<void> {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        createdBy: { select: { id: true, name: true, role: true } },
        distributions: { select: { id: true } },
        responses: {
          include: { answers: true, responder: { select: { id: true, name: true, role: true } } },
        },
      },
    })

    if (!survey) {
      res.status(404).json({ error: 'Survey not found' })
      return
    }

    res.json(survey)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function submitResponse(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { answers, deviceTime } = req.body

    const survey = await prisma.survey.findUnique({ where: { id } })
    if (!survey) {
      res.status(404).json({ error: 'Survey not found' })
      return
    }

    if (survey.status === 'CLOSED') {
      res.status(400).json({ error: 'Survey is closed' })
      return
    }

    if (!Array.isArray(answers)) {
      res.status(400).json({ error: 'answers array is required' })
      return
    }

    try {
      const response = await prisma.surveyResponse.create({
        data: {
          surveyId: id,
          userId: req.user.userId,
          deviceTime: new Date(deviceTime),
          answers: {
            create: answers.map((a: any) => ({
              questionId: a.questionId,
              value: String(a.value),
            })),
          },
        },
        include: { answers: true },
      })

      // Publish to Redis for live dashboard
      try {
        const Redis = (await import('ioredis')).default
        const redis = new Redis(process.env.REDIS_URL!)
        await redis.publish('survey-responses', JSON.stringify({
          surveyId: id,
          userId: req.user.userId,
        }))
        await redis.quit()
      } catch {
        // Redis not configured — silent
      }

      res.status(201).json({ message: 'Response recorded', responseId: response.id })
    } catch (e: any) {
      if (e.code === 'P2002') {
        res.status(409).json({ message: 'Response already submitted for this survey' })
        return
      }
      throw e
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function syncSurveyResponses(req: any, res: Response): Promise<void> {
  try {
    const { responses } = req.body
    if (!Array.isArray(responses)) {
      res.status(400).json({ error: 'Expected an array of responses' })
      return
    }

    const results = []

    for (const r of responses) {
      try {
        await prisma.surveyResponse.create({
          data: {
            id: r.id,
            surveyId: r.surveyId,
            userId: req.user.userId,
            deviceTime: new Date(r.deviceTime),
            answers: {
              create: Array.isArray(r.answers)
                ? r.answers.map((a: any) => ({
                    questionId: a.questionId,
                    value: String(a.value),
                  }))
                : [],
            },
          },
        })
        results.push({ id: r.id, status: 'created' })
      } catch (e: any) {
        if (e.code === 'P2002') {
          results.push({ id: r.id, status: 'already_exists' })
        } else {
          throw e
        }
      }
    }

    res.status(200).json({ message: 'Sync complete', results })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listSurveys(req: any, res: Response): Promise<void> {
  try {
    const { examId, status } = req.query
    const where: any = {}
    if (examId) where.examId = String(examId)
    if (status) where.status = String(status)

    const surveys = await prisma.survey.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        _count: { select: { distributions: true, responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(surveys)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function closeSurvey(req: any, res: Response): Promise<void> {
  try {
    const survey = await prisma.survey.findUnique({ where: { id: req.params.id } })
    if (!survey) {
      res.status(404).json({ error: 'Survey not found' })
      return
    }

    const updated = await prisma.survey.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function liveResponsesSSE(req: any, res: Response): Promise<void> {
  try {
    const surveyId = req.params.id

    const survey = await prisma.survey.findUnique({ where: { id: surveyId } })
    if (!survey) {
      res.status(404).json({ error: 'Survey not found' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Send initial summary
    const initialSummary = await buildResponseSummary(surveyId)
    res.write(`data: ${JSON.stringify(initialSummary)}\n\n`)

    let redis: any = null
    try {
      const Redis = (await import('ioredis')).default
      redis = new Redis(process.env.REDIS_URL!)

      redis.subscribe('survey-responses', (err: any) => {
        if (err) {
          res.write(`data: ${JSON.stringify({ error: 'Redis subscription failed' })}\n\n`)
          res.end()
          return
        }
      })

      redis.on('message', async (_channel: string, message: string) => {
        try {
          const payload = JSON.parse(message)
          if (payload.surveyId !== surveyId) return

          const summary = await buildResponseSummary(surveyId)
          res.write(`data: ${JSON.stringify(summary)}\n\n`)
        } catch {
          // Ignore parse errors
        }
      })
    } catch {
      // Redis not available — SSE will just serve the initial summary
      console.log('[SURVEY SSE] Redis not configured. Live updates disabled.')
    }

    req.on('close', () => {
      if (redis) {
        redis.unsubscribe()
        redis.quit()
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
