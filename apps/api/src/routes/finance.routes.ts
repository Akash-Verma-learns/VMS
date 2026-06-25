import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { randomUUID } from 'crypto'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { computeAdvance, listCalculations, submitBill, listBills, verifyBill, approveBill } from '../controllers/finance.controller'

const router = Router()

const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'bills'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only PDF, JPEG, PNG, or WebP files are allowed'))
  },
})

router.post('/calculate', requireAuth, requireRole('ASO', 'SO'), computeAdvance)
router.get('/calculate/:examId', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), listCalculations)
router.post('/bills', requireAuth, requireRole('VS', 'CS'), submitBill)
router.get('/bills/:examId', requireAuth, requireRole('US', 'DS', 'JS'), listBills)
router.patch('/bills/:billId/verify', requireAuth, requireRole('US'), verifyBill)
router.patch('/bills/:billId/approve', requireAuth, requireRole('DS'), approveBill)

// Bill document upload: returns { url } for use as documentUrl in POST /bills
router.post('/bills/upload', requireAuth, requireRole('VS', 'CS'), upload.single('document'), (req: any, res: any) => {
  if (!req.file) { res.status(400).json({ error: 'No file provided' }); return }
  const ext = path.extname(req.file.originalname).toLowerCase()
  const url = `/uploads/bills/${req.file.filename}${ext}`
  res.json({ url })
})

export default router
