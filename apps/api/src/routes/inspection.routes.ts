import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  assignInspection,
  listInspections,
  myInspections,
  submitInspection,
  reviewInspection,
} from '../controllers/inspection.controller'

const router = Router()

router.post('/', requireAuth, requireRole('US', 'SO'), assignInspection)
// /my must be registered before /:examId to avoid route shadowing
router.get('/my', requireAuth, requireRole('IO'), myInspections)
router.get('/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), listInspections)
router.patch('/:id/submit', requireAuth, requireRole('IO'), submitInspection)
router.patch('/:id/review', requireAuth, requireRole('SO', 'US'), reviewInspection)

export default router
