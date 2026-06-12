import { Router } from 'express'
import { generatePIN, listPINs, confirmDispatch, syncMaterialLogs, getManifestPDF } from '../controllers/material-tracking.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'

const router = Router()

router.post('/pin', requireAuth, requireRole('ASO', 'SO'), generatePIN)
router.get('/pins', requireAuth, requireRole('ASO', 'SO', 'US', 'DS'), listPINs)
router.post('/dispatch', requireAuth, requireRole('ASO'), confirmDispatch)
router.post('/sync', requireAuth, requireRole('VS', 'CS'), syncMaterialLogs)
router.get('/manifest/:examId', requireAuth, requireRole('ASO', 'SO'), getManifestPDF)

export default router
