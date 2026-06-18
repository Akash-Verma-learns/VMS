import { Response } from 'express'
import prisma from '../lib/prisma'

export async function createJob(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.body
    if (!examId) {
      res.status(400).json({ error: 'examId is required' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }

    const job = await prisma.faceCheckJob.create({
      data: {
        examId,
        createdById: req.user.userId,
      },
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    })

    res.status(201).json(job)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function uploadReferencePhoto(req: any, res: Response): Promise<void> {
  try {
    const { jobId } = req.params
    const label = req.body.label

    if (!label) {
      res.status(400).json({ error: 'label is required' })
      return
    }

    const job = await prisma.faceCheckJob.findUnique({ where: { id: jobId } })
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: 'photo file is required' })
      return
    }

    // Upload to MinIO if configured, else fallback
    let photoUrl = `local://reference-photos/${jobId}/${label}.png`

    const endpoint = process.env.MINIO_ENDPOINT
    const accessKey = process.env.MINIO_ACCESS_KEY
    const secretKey = process.env.MINIO_SECRET_KEY
    const bucket = process.env.MINIO_BUCKET ?? 'vms-assets'

    if (endpoint && accessKey && secretKey) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const s3 = new S3Client({
          endpoint,
          region: 'us-east-1',
          credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
          forcePathStyle: true,
        })

        const key = `face-auth/reference/${jobId}/${label}-${Date.now()}.png`
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        }))

        photoUrl = `${endpoint}/${bucket}/${key}`
      } catch (err: any) {
        console.error(`[FACE AUTH] Failed to upload to MinIO: ${err.message}`)
      }
    } else {
      console.log(`[FACE AUTH] MinIO not configured. Photo stored as placeholder: ${photoUrl}`)
    }

    const refPhoto = await prisma.faceReferencePhoto.create({
      data: {
        jobId,
        photoUrl,
        label,
      },
    })

    res.status(201).json(refPhoto)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listReferencePhotos(req: any, res: Response): Promise<void> {
  try {
    const { jobId } = req.params

    const photos = await prisma.faceReferencePhoto.findMany({
      where: { jobId },
      orderBy: { uploadedAt: 'asc' },
    })

    res.json(photos)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function startJob(req: any, res: Response): Promise<void> {
  try {
    const { jobId } = req.params

    const job = await prisma.faceCheckJob.findUnique({
      where: { id: jobId },
      include: { referencePhotos: true },
    })

    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    if (job.status !== 'PENDING') {
      res.status(400).json({ error: `Job is already ${job.status}` })
      return
    }

    // Set job to RUNNING
    const updatedJob = await prisma.faceCheckJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
      include: {
        exam: { select: { id: true, name: true } },
        referencePhotos: true,
      },
    })

    // Fetch all venue photos for this exam
    const fieldReports = await prisma.fieldReport.findMany({
      where: {
        venue: { assignments: { some: { examId: job.examId } } },
      },
      include: {
        photos: { select: { id: true, photoUrl: true, capturedAt: true } },
      },
    })

    const venuePhotoUrls = fieldReports.flatMap(r =>
      r.photos.map(p => ({ id: p.id, photoUrl: p.photoUrl, capturedAt: p.capturedAt }))
    )

    const referencePhotoUrls = updatedJob.referencePhotos.map(p => ({
      id: p.id,
      photoUrl: p.photoUrl,
      label: p.label,
    }))

    res.json({
      job: updatedJob,
      venuePhotoUrls,
      referencePhotoUrls,
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function submitResults(req: any, res: Response): Promise<void> {
  try {
    const { jobId } = req.params
    const { results, totalComparisons } = req.body

    if (!Array.isArray(results)) {
      res.status(400).json({ error: 'results array is required' })
      return
    }

    const job = await prisma.faceCheckJob.findUnique({ where: { id: jobId } })
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    // Bulk insert results
    await prisma.faceCheckResult.createMany({
      data: results.map((r: any) => ({
        jobId,
        venuePhotoId: r.venuePhotoId,
        referencePhotoId: r.referencePhotoId,
        distance: r.distance,
        matched: r.matched,
        threshold: r.threshold ?? 0.6,
      })),
    })

    const flaggedCount = results.filter((r: any) => r.matched).length

    // Update job status
    await prisma.faceCheckJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalComparisons: totalComparisons ?? results.length,
        flaggedCount,
      },
    })

    res.json({ inserted: results.length, flagged: flaggedCount })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listResults(req: any, res: Response): Promise<void> {
  try {
    const { jobId } = req.params
    const { matched } = req.query

    const where: any = { jobId }
    if (matched === 'true') where.matched = true

    const results = await prisma.faceCheckResult.findMany({
      where,
      include: {
        referencePhoto: { select: { id: true, photoUrl: true, label: true } },
      },
      orderBy: { distance: 'asc' },
    })

    res.json(results)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function reviewResult(req: any, res: Response): Promise<void> {
  try {
    const { resultId } = req.params
    const { reviewStatus, reviewNote } = req.body

    const validStatuses = ['CONFIRMED_MATCH', 'FALSE_POSITIVE', 'INCONCLUSIVE']
    if (!validStatuses.includes(reviewStatus)) {
      res.status(400).json({ error: `reviewStatus must be one of: ${validStatuses.join(', ')}` })
      return
    }

    const result = await prisma.faceCheckResult.findUnique({ where: { id: resultId } })
    if (!result) {
      res.status(404).json({ error: 'Result not found' })
      return
    }

    // Prevent re-review after CONFIRMED_MATCH
    if (result.reviewStatus === 'CONFIRMED_MATCH') {
      res.status(400).json({ error: 'Cannot modify a confirmed match result' })
      return
    }

    const updated = await prisma.faceCheckResult.update({
      where: { id: resultId },
      data: {
        reviewStatus,
        reviewNote: reviewNote ?? null,
        reviewedById: req.user.userId,
        reviewedAt: new Date(),
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `FACE_RESULT_REVIEWED:${reviewStatus}:${resultId}`,
        ipAddress: req.ip,
      },
    })

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listJobs(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.query
    const where: any = {}
    if (examId) where.examId = String(examId)

    const jobs = await prisma.faceCheckJob.findMany({
      where,
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        _count: { select: { results: true, referencePhotos: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(jobs)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
