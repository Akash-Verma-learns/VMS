import { Router } from 'express'
import { requestOtp, verifyOtpAndLogin, logout } from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.post('/request-otp', requestOtp)
router.post('/verify-otp',  verifyOtpAndLogin)
router.post('/logout',      requireAuth, logout)

export default router