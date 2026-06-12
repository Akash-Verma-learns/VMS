import prisma from '../lib/prisma'
import { RecipientFilter } from '../types/survey.types'

export async function resolveRecipients(filter: RecipientFilter): Promise<string[]> {
  // If explicit userIds, validate they exist and return directly
  if (filter.userIds && filter.userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: filter.userIds }, isActive: true },
      select: { id: true },
    })
    return users.map(u => u.id)
  }

  // Build user query from role + location + exam filters
  const roleFilter = filter.roles && filter.roles.length > 0
    ? { role: { in: filter.roles as any } }
    : {}

  // If examId set: find users assigned to venues for that exam
  if (filter.examId) {
    const assignments = await prisma.venueAssignment.findMany({
      where: {
        examId: filter.examId,
        ...(filter.cityNames && filter.cityNames.length > 0
          ? { venue: { cityName: { in: filter.cityNames } } }
          : {}),
      },
      select: { vsId: true, csId: true },
    })

    const userIds = new Set<string>()
    for (const a of assignments) {
      if (a.vsId) userIds.add(a.vsId)
      if (a.csId) userIds.add(a.csId)
    }

    // If role filter: intersect with assignment users
    if (filter.roles && filter.roles.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) }, ...roleFilter, isActive: true },
        select: { id: true },
      })
      return users.map(u => u.id)
    }

    return Array.from(userIds)
  }

  // If cityNames but no examId: find users through venue assignments in those cities
  if (filter.cityNames && filter.cityNames.length > 0) {
    const assignments = await prisma.venueAssignment.findMany({
      where: { venue: { cityName: { in: filter.cityNames } } },
      select: { vsId: true, csId: true },
    })

    const userIds = new Set<string>()
    for (const a of assignments) {
      if (a.vsId) userIds.add(a.vsId)
      if (a.csId) userIds.add(a.csId)
    }

    if (filter.roles && filter.roles.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) }, ...roleFilter, isActive: true },
        select: { id: true },
      })
      return users.map(u => u.id)
    }

    return Array.from(userIds)
  }

  // Roles only — get all active users with those roles
  const users = await prisma.user.findMany({
    where: { ...roleFilter, isActive: true },
    select: { id: true },
  })
  return users.map(u => u.id)
}

export async function publishSurvey(surveyId: string, filter: RecipientFilter): Promise<number> {
  const recipientIds = await resolveRecipients(filter)

  // Bulk insert SurveyDistribution rows
  await prisma.surveyDistribution.createMany({
    data: recipientIds.map(userId => ({
      surveyId,
      userId,
    })),
    skipDuplicates: true,
  })

  // Update survey status
  await prisma.survey.update({
    where: { id: surveyId },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  })

  return recipientIds.length
}

export async function buildResponseSummary(surveyId: string) {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      distributions: { select: { id: true } },
      responses: {
        include: { answers: true },
      },
    },
  })

  if (!survey) return null

  const totalDistributed = survey.distributions.length
  const totalResponded = survey.responses.length

  const questionSummaries = survey.questions.map(q => {
    const answers = survey.responses.flatMap(r =>
      r.answers.filter(a => a.questionId === q.id)
    )

    if (q.type === 'BOOLEAN') {
      const yesCount = answers.filter(a => a.value === 'true').length
      const noCount = answers.filter(a => a.value === 'false').length
      return { questionId: q.id, text: q.text, type: q.type, yesCount, noCount, total: answers.length }
    }

    if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE') {
      const options = (q.options as string[]) ?? []
      const counts: Record<string, number> = {}
      for (const opt of options) counts[opt] = 0
      for (const a of answers) {
        if (q.type === 'MULTI_CHOICE') {
          // Multi-choice values stored as comma-separated
          const vals = a.value.split(',')
          for (const v of vals) {
            if (counts[v] !== undefined) counts[v]++
          }
        } else {
          if (counts[a.value] !== undefined) counts[a.value]++
        }
      }
      return { questionId: q.id, text: q.text, type: q.type, options: counts, total: answers.length }
    }

    // TEXT or NUMBER
    return { questionId: q.id, text: q.text, type: q.type, values: answers.map(a => a.value), total: answers.length }
  })

  return { surveyId, totalDistributed, totalResponded, questions: questionSummaries }
}
