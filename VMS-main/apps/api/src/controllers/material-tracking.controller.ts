import { Response } from 'express'
import prisma from '../lib/prisma'
import { generatePinCode, generateQRBuffer, uploadQR } from '../services/pin.service'

export async function generatePIN(req: any, res: Response): Promise<void> {
  try {
    const { examId, venueId } = req.body
    if (!examId || !venueId) {
      res.status(400).json({ error: 'examId and venueId are required' })
      return
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } })
    if (!venue) {
      res.status(404).json({ error: 'Venue not found' })
      return
    }

    // Check if PIN already exists for this exam-venue pair
    const existing = await prisma.venuePIN.findFirst({
      where: { examId, venueId },
    })
    if (existing) {
      res.status(409).json({ error: 'PIN already exists for this exam-venue pair', pin: existing })
      return
    }

    const pin = await generatePinCode(examId)
    const qrBuffer = await generateQRBuffer(pin)
    const qrUrl = await uploadQR(qrBuffer, pin)

    const venuePin = await prisma.venuePIN.create({
      data: {
        examId,
        venueId,
        pin,
        qrUrl,
        createdById: req.user.userId,
      },
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        venue: { select: { id: true, name: true, cityName: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    })

    res.status(201).json(venuePin)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function listPINs(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.query
    const pins = await prisma.venuePIN.findMany({
      where: examId ? { examId: String(examId) } : undefined,
      include: {
        exam: { select: { id: true, name: true, examCode: true } },
        venue: { select: { id: true, name: true, cityName: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        materialLogs: { orderBy: { serverTime: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(pins)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function confirmDispatch(req: any, res: Response): Promise<void> {
  try {
    const { pinId, packageCount } = req.body
    if (!pinId) {
      res.status(400).json({ error: 'pinId is required' })
      return
    }

    const pin = await prisma.venuePIN.findUnique({ where: { id: pinId } })
    if (!pin) {
      res.status(404).json({ error: 'PIN record not found' })
      return
    }

    const log = await prisma.materialLog.create({
      data: {
        pinId,
        event: 'DISPATCH_CONFIRMED',
        packageCount: packageCount ? Number(packageCount) : null,
        submittedBy: req.user.userId,
        deviceTime: new Date(),
      },
    })

    res.status(201).json(log)
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function syncMaterialLogs(req: any, res: Response): Promise<void> {
  try {
    const { logs } = req.body
    if (!Array.isArray(logs)) {
      res.status(400).json({ error: 'Expected an array of logs' })
      return
    }

    const results = []

    for (const log of logs) {
      // Idempotency check
      const existing = await prisma.materialLog.findUnique({
        where: { id: log.id },
      })

      if (existing) {
        results.push({ id: log.id, status: 'already_exists' })
        continue
      }

      await prisma.materialLog.create({
        data: {
          id: log.id,
          pinId: log.pinId,
          event: log.event,
          packageCount: log.packageCount ?? null,
          sealIntact: log.sealIntact ?? null,
          remarks: log.remarks ?? null,
          submittedBy: req.user.userId,
          deviceTime: new Date(log.deviceTime),
          latitude: log.latitude ?? null,
          longitude: log.longitude ?? null,
        },
      })
      results.push({ id: log.id, status: 'created' })

      // Discrepancy alert
      if (log.event === 'DISCREPANCY_REPORTED') {
        const alertPayload = JSON.stringify({
          venueId: log.venueId,
          pinId: log.pinId,
          userId: req.user.userId,
          ts: Date.now(),
        })

        try {
          const Redis = (await import('ioredis')).default
          const redis = new Redis(process.env.REDIS_URL!)
          await redis.publish('discrepancy-alerts', alertPayload)
          await redis.quit()
        } catch {
          console.log(`[DISCREPANCY ALERT] ${alertPayload}`)
        }
      }
    }

    res.status(200).json({ message: 'Sync complete', results })
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}

export async function getManifestPDF(req: any, res: Response): Promise<void> {
  try {
    const { examId } = req.params

    const pins = await prisma.venuePIN.findMany({
      where: { examId },
      include: { venue: { select: { name: true, cityName: true } } },
      orderBy: { createdAt: 'asc' },
    })

    if (pins.length === 0) {
      res.status(404).json({ error: 'No PINs found for this exam' })
      return
    }

    const PDFDocument = (await import('pdfkit')).default
    const QRCode = (await import('qrcode')).default

    const doc = new PDFDocument({ size: 'A4', margin: 50 })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="manifest-${examId}.pdf"`)
    doc.pipe(res)

    for (let i = 0; i < pins.length; i++) {
      const p = pins[i]
      if (i > 0) doc.addPage()

      doc.fontSize(20).text('UPSC VMS — Material Dispatch Manifest', { align: 'center' })
      doc.moveDown()
      doc.fontSize(14).text(`Venue: ${p.venue.name}`, { align: 'center' })
      doc.fontSize(12).text(`City: ${p.venue.cityName}`, { align: 'center' })
      doc.moveDown()
      doc.fontSize(16).text(`PIN: ${p.pin}`, { align: 'center' })
      doc.moveDown()

      // Generate QR as data URL and embed
      const qrDataUrl = await QRCode.toDataURL(p.pin, { width: 200, margin: 2 })
      const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '')
      const qrImageBuffer = Buffer.from(qrBase64, 'base64')
      doc.image(qrImageBuffer, (doc.page.width - 200) / 2, doc.y, { width: 200, height: 200 })
    }

    doc.end()
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', detail: error.message })
  }
}
