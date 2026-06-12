import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { computeAdvance, listCalculations, submitBill, listBills, verifyBill, approveBill } from '../controllers/finance.controller'

const router = Router()

router.post('/calculate', requireAuth, requireRole('ASO', 'SO'), computeAdvance)
router.get('/calculate/:examId', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), listCalculations)
router.post('/bills', requireAuth, requireRole('VS', 'CS'), submitBill)
router.get('/bills/:examId', requireAuth, requireRole('US', 'DS', 'JS'), listBills)
router.patch('/bills/:billId/verify', requireAuth, requireRole('US'), verifyBill)
router.patch('/bills/:billId/approve', requireAuth, requireRole('DS'), approveBill)

export default router
