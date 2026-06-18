import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { getWarRoomSnapshot } from '../controllers/dashboard.controller';

const router = Router();

// Secure the endpoint: Only UPSC management roles can view the War Room Snapshot
router.get('/snapshot', requireAuth, requireRole('JS', 'DS', 'US', 'SO'), getWarRoomSnapshot);

export default router;