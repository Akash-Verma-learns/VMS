import QRCode from 'qrcode'
import prisma from '../lib/prisma'

export async function generatePinCode(examId: string): Promise<string> {
  const year = process.env.PIN_YEAR ?? new Date().getFullYear().toString()

  // Find the last PIN number used for this year
  const lastPin = await prisma.venuePIN.findFirst({
    where: { pin: { startsWith: `VMS-${year}-` } },
    orderBy: { createdAt: 'desc' },
  })

  let nextNumber = 1
  if (lastPin) {
    const parts = lastPin.pin.split('-')
    nextNumber = parseInt(parts[2], 10) + 1
  }

  const pin = `VMS-${year}-${String(nextNumber).padStart(4, '0')}`

  // Verify uniqueness (collision-safe)
  const existing = await prisma.venuePIN.findUnique({ where: { pin } })
  if (existing) {
    // Recurse to find next available
    return generatePinCode(examId)
  }

  return pin
}

export async function generateQRBuffer(pin: string): Promise<Buffer> {
  const buffer = await QRCode.toBuffer(pin, {
    type: 'png',
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
  return buffer
}

export async function uploadQR(buffer: Buffer, filename: string): Promise<string | null> {
  // MinIO / S3 upload — graceful degradation if not configured
  const endpoint = process.env.MINIO_ENDPOINT
  const accessKey = process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_SECRET_KEY
  const bucket = process.env.MINIO_BUCKET ?? 'vms-assets'

  if (!endpoint || !accessKey || !secretKey) {
    console.log(`[PIN SERVICE] MinIO not configured. QR for ${filename} generated but not uploaded.`)
    return null
  }

  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const s3 = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    })

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `qr/${filename}.png`,
      Body: buffer,
      ContentType: 'image/png',
    }))

    return `${endpoint}/${bucket}/qr/${filename}.png`
  } catch (error: any) {
    console.error(`[PIN SERVICE] Failed to upload QR: ${error.message}`)
    return null
  }
}
