import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { createExam, listExams, getExam, releaseExam, updateCentre, lookupExamByCode } from '../controllers/exam.controller'
import { createAssignment, listAssignments, updateAssignment, submitAssignments, getMyAssignments } from '../controllers/venue.controller'

const router = Router()

// MOD-02: Exam management
router.post('/', requireAuth, requireRole('ASO', 'SO'), createExam)
router.get('/', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), listExams)
// CS uses this to resolve exam code → UUID before submitting venues
router.get('/lookup', requireAuth, requireRole('CS'), lookupExamByCode)
router.get('/:id', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), getExam)
router.patch('/:id/release', requireAuth, requireRole('US'), releaseExam)
router.patch('/:id/centre/:centreId', requireAuth, requireRole('SO', 'US'), updateCentre)

// MOD-03: Venue assignments
router.get('/assignments/mine', requireAuth, requireRole('CS'), getMyAssignments)
router.post('/:examId/assignments/submit', requireAuth, requireRole('CS'), submitAssignments)
router.post('/:examId/assignments', requireAuth, requireRole('CS'), createAssignment)
router.get('/:examId/assignments', requireAuth, requireRole('CS', 'SO', 'US', 'DS', 'JS', 'ASO'), listAssignments)
router.patch('/:examId/assignments/:assignmentId', requireAuth, requireRole('SO', 'US'), updateAssignment)

export default router
