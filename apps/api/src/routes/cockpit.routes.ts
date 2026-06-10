import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  getExamStatus,
  getTeamWorkload,
  getAlerts,
  sendNotification,
  getAttendanceReport,
  getFinancialReport,
  getVenueStatusReport,
  getInspectionSummary,
  getMaterialTrackingReport,
} from '../controllers/cockpit.controller'

const cockpitRouter = Router()
const reportRouter = Router()

// Cockpit routes
cockpitRouter.get('/exam-status/:examId', requireAuth, requireRole('US', 'DS', 'JS'), getExamStatus)
cockpitRouter.get('/team-workload', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getTeamWorkload)
cockpitRouter.get('/alerts/:examId', requireAuth, requireRole('US', 'DS', 'JS'), getAlerts)
cockpitRouter.post('/notify', requireAuth, requireRole('US', 'DS', 'JS'), sendNotification)

// Report routes
reportRouter.get('/attendance/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getAttendanceReport)
reportRouter.get('/financial/:examId', requireAuth, requireRole('US', 'DS', 'JS'), getFinancialReport)
reportRouter.get('/venue-status/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getVenueStatusReport)
reportRouter.get('/inspection-summary/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getInspectionSummary)
reportRouter.get('/material-tracking/:examId', requireAuth, requireRole('SO', 'US', 'DS', 'JS'), getMaterialTrackingReport)

export { cockpitRouter, reportRouter }
