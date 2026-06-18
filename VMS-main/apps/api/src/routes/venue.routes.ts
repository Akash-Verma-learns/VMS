import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { createVenue, listVenues } from '../controllers/venue.controller'

const router = Router()

router.post('/', requireAuth, requireRole('CS', 'SO', 'US'), createVenue)
router.get('/', requireAuth, requireRole('CS', 'SO', 'US', 'DS', 'JS'), listVenues)

export default router
