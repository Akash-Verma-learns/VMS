import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  runAllocation, releaseAdmitCards, listAllocations, lookupAdmitCard, dataCheck,
} from '../controllers/admitcard.controller'

const router = Router()

// Public — a candidate looks up their own card. Released cards only.
router.get('/lookup', lookupAdmitCard)

// ASO/SO prepare the allotment; US publishes it, mirroring exam release.
router.post('/:examId/allocate', requireAuth, requireRole('ASO', 'SO'), runAllocation)
router.post('/:examId/release', requireAuth, requireRole('US'), releaseAdmitCards)

// Read-only completeness report — anyone who can see the roll can run it.
router.get('/:examId/data-check', requireAuth,
  requireRole('ASO', 'SO', 'US', 'DS', 'JS', 'CS', 'VS'), dataCheck)

// Officers read the roll; CS/VS need it at the venue for the gate terminal.
router.get('/:examId', requireAuth,
  requireRole('ASO', 'SO', 'US', 'DS', 'JS', 'CS', 'VS'), listAllocations)

export default router
