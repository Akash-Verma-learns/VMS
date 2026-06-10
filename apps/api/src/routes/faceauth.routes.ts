import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  ingestFaceAuth,
  getFlaggedRecords,
  reviewFaceAuth,
  confirmJammer,
  getJammerStatus,
} from '../controllers/faceauth.controller'

const router = Router()

router.post('/ingest', requireAuth, requireRole('ASO'), ingestFaceAuth)
router.get('/flags/:examId', requireAuth, requireRole('US', 'DS', 'JS'), getFlaggedRecords)
router.patch('/:id/review', requireAuth, requireRole('US', 'DS'), reviewFaceAuth)
router.post('/jammer', requireAuth, requireRole('VS', 'IO', 'CS'), confirmJammer)
router.get('/jammer/:examId', requireAuth, requireRole('CS', 'SO', 'US', 'DS', 'JS'), getJammerStatus)

export default router
