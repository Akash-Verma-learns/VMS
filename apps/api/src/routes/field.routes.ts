import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  submitCheckpoint,
  getCheckpoints,
  submitReadiness,
  getReadiness,
  reviewReadiness,
  getDrillStatus,
} from '../controllers/field.controller'

const router = Router()

router.post('/checkpoint', requireAuth, requireRole('VS', 'CS', 'IO'), submitCheckpoint)
router.get('/checkpoint/:examId/:venueId', requireAuth, requireRole('VS', 'CS', 'SO', 'US', 'DS', 'JS'), getCheckpoints)
router.post('/readiness', requireAuth, requireRole('VS'), submitReadiness)
router.get('/readiness/:examId', requireAuth, requireRole('CS', 'SO', 'US', 'DS', 'JS'), getReadiness)
router.patch('/readiness/:id/review', requireAuth, requireRole('CS'), reviewReadiness)
router.get('/drill-status/:examId', requireAuth, requireRole('CS', 'SO', 'US'), getDrillStatus)

export default router
