import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { createApproval, listApprovals, actionApproval, listMyRejectedApprovals } from '../controllers/approval.controller'

const router = Router()

router.post('/', requireAuth, requireRole('ASO', 'SO'), createApproval)
router.get('/', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), listApprovals)
router.get('/mine/rejected', requireAuth, requireRole('ASO', 'SO'), listMyRejectedApprovals)
router.patch('/:id/action', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), actionApproval)

export default router
