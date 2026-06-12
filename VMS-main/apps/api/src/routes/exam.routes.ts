import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { createExam, listExams, getExam, releaseExam, updateCentre } from '../controllers/exam.controller'
import { createAssignment, listAssignments, updateAssignment, submitAssignments } from '../controllers/venue.controller'

const router = Router()

// MOD-02: Exam management
router.post('/', requireAuth, requireRole('ASO', 'SO'), createExam)
router.get('/', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), listExams)
router.get('/:id', requireAuth, requireRole('ASO', 'SO', 'US', 'DS', 'JS'), getExam)
router.patch('/:id/release', requireAuth, requireRole('US'), releaseExam)
router.patch('/:id/centre/:centreId', requireAuth, requireRole('SO', 'US'), updateCentre)

// MOD-03: Venue assignments (submit before :assignmentId to avoid route shadowing)
router.post('/:examId/assignments/submit', requireAuth, requireRole('CS'), submitAssignments)
router.post('/:examId/assignments', requireAuth, requireRole('CS'), createAssignment)
router.get('/:examId/assignments', requireAuth, requireRole('CS', 'SO', 'US', 'DS', 'JS'), listAssignments)
router.patch('/:examId/assignments/:assignmentId', requireAuth, requireRole('SO', 'US'), updateAssignment)

export default router
