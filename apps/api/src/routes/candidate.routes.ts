import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { submitPreference, listPreferences, getPreferenceSummary, getExamCities } from '../controllers/candidate.controller'

const router = Router()

// Public endpoints — no login required
// Public: ?code=UPSC/2030/CSP  (query param avoids slash-in-path routing issues)
router.get('/exam-cities', getExamCities)
router.post('/preferences', submitPreference)

// Officer endpoints — view preferences per exam
router.get('/preferences', requireAuth, requireRole('SO', 'US', 'DS', 'JS', 'ASO'), listPreferences)
router.get('/preferences/summary', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getPreferenceSummary)

export default router
