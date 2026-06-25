import { Router } from 'express'
import { syncReports, heartbeat } from '../controllers/field-report.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'

const router = Router()

router.use(requireAuth)
router.post('/sync', requireRole('VS', 'IO', 'CS'), syncReports)
router.post('/heartbeat', requireRole('VS', 'IO', 'CS'), heartbeat)

export default router
