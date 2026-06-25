import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { createVenue, listVenues, listPendingVenues, approveVenue, rejectVenue } from '../controllers/venue.controller'

const router = Router()

router.post('/', requireAuth, requireRole('CS', 'SO', 'US'), createVenue)
router.get('/', requireAuth, requireRole('CS', 'SO', 'US', 'DS', 'JS'), listVenues)
router.get('/pending', requireAuth, requireRole('SO', 'US'), listPendingVenues)
router.patch('/:id/approve', requireAuth, requireRole('SO', 'US'), approveVenue)
router.patch('/:id/reject', requireAuth, requireRole('SO', 'US'), rejectVenue)

export default router
