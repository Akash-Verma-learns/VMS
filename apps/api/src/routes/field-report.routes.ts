import { Router } from 'express'
import { syncReports, heartbeat } from '../controllers/field-report.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.use(requireAuth)
router.post('/sync', syncReports)
router.post('/heartbeat', heartbeat)

export default router
