import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  createSurvey,
  listSurveys,
  mySurveys,
  respondSurvey,
  getSurveyResponses,
  getSurveyStats,
} from '../controllers/survey.controller'

const router = Router()

router.post('/', requireAuth, requireRole('US', 'SO'), createSurvey)
router.get('/', requireAuth, requireRole('US', 'SO', 'DS', 'JS'), listSurveys)
// /my must be registered before /:id routes to avoid shadowing
router.get('/my', requireAuth, requireRole('CS', 'VS', 'IO'), mySurveys)
router.post('/:id/respond', requireAuth, requireRole('CS', 'VS', 'IO'), respondSurvey)
router.get('/:id/responses', requireAuth, requireRole('US', 'SO', 'DS', 'JS'), getSurveyResponses)
router.get('/:id/stats', requireAuth, requireRole('US', 'SO', 'DS', 'JS'), getSurveyStats)

export default router
