import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  getExamStatus,
  getTeamWorkload,
  getAlerts,
  sendNotification,
  streamExamStatus,
  getAttendanceReport,
  getFinancialReport,
  getVenueStatusReport,
  getInspectionSummary,
  getMaterialTrackingReport,
  getPwBDReport,
  getFALStatusReport,
  getJammerStatusReport,
} from '../controllers/cockpit.controller'

const cockpitRouter = Router()
const reportRouter = Router()

// Cockpit routes
cockpitRouter.get('/exam-status/:examId', requireAuth, requireRole('US', 'DS', 'JS'), getExamStatus)
cockpitRouter.get('/team-workload', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getTeamWorkload)
cockpitRouter.get('/alerts/:examId', requireAuth, requireRole('US', 'DS', 'JS'), getAlerts)
cockpitRouter.post('/notify', requireAuth, requireRole('US', 'DS', 'JS'), sendNotification)
// GAP 4: SSE stream — must be registered before /:examId patterns
cockpitRouter.get('/stream/:examId', requireAuth, requireRole('US', 'DS', 'JS'), streamExamStatus)

// Report routes
reportRouter.get('/attendance/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getAttendanceReport)
reportRouter.get('/financial/:examId', requireAuth, requireRole('US', 'DS', 'JS'), getFinancialReport)
reportRouter.get('/venue-status/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getVenueStatusReport)
reportRouter.get('/inspection-summary/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getInspectionSummary)
reportRouter.get('/material-tracking/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getMaterialTrackingReport)
// GAP 4: New reports
reportRouter.get('/pwbd/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getPwBDReport)
reportRouter.get('/fal-status/:examId', requireAuth, requireRole('US', 'DS', 'JS'), getFALStatusReport)
reportRouter.get('/jammer-status/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getJammerStatusReport)

export { cockpitRouter, reportRouter }
