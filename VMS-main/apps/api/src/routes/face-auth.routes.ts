import { Router } from 'express'
import multer from 'multer'
import {
  createJob, uploadReferencePhoto, listReferencePhotos,
  startJob, submitResults, listResults, reviewResult, listJobs
} from '../controllers/face-auth.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.post('/jobs', requireAuth, requireRole('US'), createJob)
router.post('/jobs/:jobId/reference-photos', requireAuth, requireRole('US'), upload.single('photo'), uploadReferencePhoto)
router.get('/jobs/:jobId/reference-photos', requireAuth, requireRole('US', 'DS'), listReferencePhotos)
router.patch('/jobs/:jobId/start', requireAuth, requireRole('US'), startJob)
router.post('/jobs/:jobId/results', requireAuth, requireRole('US'), submitResults)
router.get('/jobs/:jobId/results', requireAuth, requireRole('US', 'DS'), listResults)
router.patch('/results/:resultId/review', requireAuth, requireRole('DS'), reviewResult)
router.get('/jobs', requireAuth, requireRole('US', 'DS'), listJobs)

export default router
