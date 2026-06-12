import { Router } from 'express'
import {
  createSurvey, publishSurvey, listMySurveys, getSurveyDetails,
  submitResponse, syncSurveyResponses, listSurveys, closeSurvey, liveResponsesSSE
} from '../controllers/survey.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'

const router = Router()

router.post('/', requireAuth, requireRole('US', 'SO'), createSurvey)
router.post('/:id/publish', requireAuth, requireRole('US', 'SO'), publishSurvey)
router.get('/mine', requireAuth, listMySurveys)
router.post('/:id/response', requireAuth, submitResponse)
router.post('/sync', requireAuth, syncSurveyResponses)
router.get('/:id/live', requireAuth, requireRole('US', 'SO', 'DS'), liveResponsesSSE)
router.patch('/:id/close', requireAuth, requireRole('US', 'SO'), closeSurvey)
router.get('/', requireAuth, requireRole('US', 'SO', 'DS'), listSurveys)
router.get('/:id', requireAuth, getSurveyDetails)

export default router
