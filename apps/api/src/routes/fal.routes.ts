import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { createFAL, listFALs, getFAL, sanctionFAL, acknowledgeFAL, createReminder } from '../controllers/fal.controller'

const router = Router()

router.post('/', requireAuth, requireRole('ASO', 'SO'), createFAL)
router.get('/', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), listFALs)
router.get('/:id', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), getFAL)
router.patch('/:id/sanction', requireAuth, requireRole('DS'), sanctionFAL)
router.patch('/:id/acknowledge', requireAuth, requireRole('CS'), acknowledgeFAL)
router.post('/:id/reminder', requireAuth, requireRole('ASO', 'SO', 'US'), createReminder)

export default router
