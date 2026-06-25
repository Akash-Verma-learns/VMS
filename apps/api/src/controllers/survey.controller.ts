import { Response } from 'express'
import prisma from '../lib/prisma'
import { mailer } from '../lib/mailer'

export async function createSurvey(req: any, res: Response): Promise<void> {
  try {
    const { title, examId, questions, recipientRoles, recipientCities, deadline } = req.body
    if (!title || !questions || !recipientRoles || !deadline) {
      res.status(400).json({ error: 'Missing required fields: title, questions, recipientRoles, deadline' })
      return
    }

    const survey = await prisma.survey.create({
      data: {
        title,
        examId: examId ?? null,
        createdBy: req.user.userId,
        questions,
        recipientRoles: recipientRoles ?? [],
        recipientCities: recipientCities ?? [],
        deadline: new Date(deadline),
      },
    })

    // Log notification dispatch intent (job queue would handle actual delivery in production)
    const recipientCount = await prisma.user.count({ where: { role: { in: recipientRoles } } })
    console.log(`[SURVEY] Created survey "${title}" — notifying ~${recipientCount} recipients (roles: ${recipientRoles.join(', ')})`)

    res.status(201).json({ ...survey, recipientCount })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listSurveys(_req: any, res: Response): Promise<void> {
  try {
    const surveys = await prisma.survey.findMany({
      include: {
        creator: { select: { id: true, name: true, role: true } },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(surveys)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function mySurveys(req: any, res: Response): Promise<void> {
  try {
    const surveys = await prisma.survey.findMany({
      where: {
        recipientRoles: { has: req.user.role },
        status: 'ACTIVE',
        deadline: { gte: new Date() },
      },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        responses: {
          where: { responderId: req.user.userId },
          select: { id: true, isDraft: true, submittedAt: true },
        },
      },
      orderBy: { deadline: 'asc' },
    })
    res.json(surveys)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function respondSurvey(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { answers, isDraft } = req.body

    if (!answers) {
      res.status(400).json({ error: 'answers is required' })
      return
    }

    const survey = await prisma.survey.findUnique({ where: { id } })
    if (!survey) { res.status(404).json({ error: 'Survey not found' }); return }
    if (survey.status !== 'ACTIVE') { res.status(409).json({ error: 'Survey is not active' }); return }

    const recipientRoles: string[] = Array.isArray(survey.recipientRoles) ? survey.recipientRoles as string[] : []
    if (recipientRoles.length > 0 && !recipientRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Your role is not a recipient of this survey' })
      return
    }

    // Upsert: replace existing draft or create new response
    const existing = await prisma.surveyResponse.findFirst({
      where: { surveyId: id, responderId: req.user.userId, isDraft: true },
    })

    let response
    if (existing) {
      response = await prisma.surveyResponse.update({
        where: { id: existing.id },
        data: { answers, isDraft: isDraft ?? false, submittedAt: new Date() },
      })
    } else {
      response = await prisma.surveyResponse.create({
        data: {
          surveyId: id,
          responderId: req.user.userId,
          answers,
          isDraft: isDraft ?? false,
        },
      })
    }
    res.status(201).json(response)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getSurveyResponses(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const survey = await prisma.survey.findUnique({ where: { id } })
    if (!survey) { res.status(404).json({ error: 'Survey not found' }); return }

    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: id, isDraft: false },
      include: { responder: { select: { id: true, name: true, role: true } } },
      orderBy: { submittedAt: 'desc' },
    })

    const totalRecipients = await prisma.user.count({ where: { role: { in: survey.recipientRoles as any } } })
    const completionRate = totalRecipients > 0 ? Math.round((responses.length / totalRecipients) * 100) : 0

    res.json({ survey: { id, title: survey.title }, totalRecipients, submitted: responses.length, completionRate, responses })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getSurveyStats(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const survey = await prisma.survey.findUnique({ where: { id } })
    if (!survey) { res.status(404).json({ error: 'Survey not found' }); return }

    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: id, isDraft: false },
      select: { answers: true, responderId: true },
    })

    const totalRecipients = await prisma.user.count({ where: { role: { in: survey.recipientRoles as any } } })
    const responseRate = totalRecipients > 0 ? Math.round((responses.length / totalRecipients) * 100) : 0

    // Aggregate answers per question key
    const aggregated: Record<string, any[]> = {}
    for (const r of responses) {
      const ans = r.answers as Record<string, any>
      for (const [key, value] of Object.entries(ans)) {
        if (!aggregated[key]) aggregated[key] = []
        aggregated[key].push(value)
      }
    }

    res.json({
      surveyId: id,
      title: survey.title,
      totalRecipients,
      totalResponses: responses.length,
      responseRate,
      questionAggregation: aggregated,
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

// GAP 3: Remind users who have not yet responded
export async function remindSurvey(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const survey = await prisma.survey.findUnique({ where: { id } })
    if (!survey) { res.status(404).json({ error: 'Survey not found' }); return }
    if (survey.status !== 'ACTIVE') { res.status(409).json({ error: 'Survey is not active' }); return }

    const [recipients, responded] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: survey.recipientRoles as any } },
        select: { id: true, email: true, name: true },
      }),
      prisma.surveyResponse.findMany({
        where: { surveyId: id, isDraft: false },
        select: { responderId: true },
      }),
    ])

    const respondedIds = new Set(responded.map(r => r.responderId))
    const pending = recipients.filter(u => !respondedIds.has(u.id))

    for (const user of pending) {
      await mailer.sendMail({
        from: 'vms@upsc.gov.in',
        to: user.email,
        subject: `[UPSC VMS] Reminder: Please complete survey "${survey.title}"`,
        text: `Dear ${user.name},\n\nThis is a reminder to complete the survey: "${survey.title}".\nDeadline: ${survey.deadline.toISOString()}\n\nUPSC VMS`,
      })
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: `SURVEY_REMINDER sent to ${user.email} for survey ${id}`,
          ipAddress: req.ip,
        },
      })
    }

    res.json({ reminded: pending.length, recipients: pending.map(u => u.email) })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

// GAP 3: Export all submitted responses (JSON; hook in exceljs/pdfkit for other formats)
export async function exportSurvey(req: any, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const survey = await prisma.survey.findUnique({ where: { id } })
    if (!survey) { res.status(404).json({ error: 'Survey not found' }); return }

    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: id, isDraft: false },
      include: { responder: { select: { id: true, name: true, role: true, email: true } } },
      orderBy: { submittedAt: 'asc' },
    })

    res.json({
      survey: { id: survey.id, title: survey.title, deadline: survey.deadline },
      totalResponses: responses.length,
      responses: responses.map(r => ({
        responderId: r.responderId,
        responder: r.responder,
        answers: r.answers,
        submittedAt: r.submittedAt,
      })),
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
