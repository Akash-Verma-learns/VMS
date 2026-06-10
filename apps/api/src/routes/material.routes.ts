import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  generateMaterialPin,
  listPins,
  confirmMaterial,
  getTrackingChain,
  getDiscrepancies,
} from '../controllers/material.controller'

const router = Router()

router.post('/pin', requireAuth, requireRole('ASO', 'SO'), generateMaterialPin)
router.get('/pin/:examId', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), listPins)
router.post('/confirm', requireAuth, requireRole('VS', 'CS'), confirmMaterial)
router.get('/tracking/:venueId/:examId', requireAuth, requireRole('CS', 'SO', 'US', 'DS', 'JS'), getTrackingChain)
router.get('/discrepancies/:examId', requireAuth, requireRole('CS', 'SO', 'US', 'DS', 'JS'), getDiscrepancies)

export default router
