import express from 'express';
import { analyticsController } from '../controllers/analyticsController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

router.use(authGuard);

router.get('/admin', roleGuard('ADMIN'), analyticsController.getAdminStats);
router.get('/hr', roleGuard('ADMIN', 'HR'), analyticsController.getHrStats);
router.get('/employee', analyticsController.getEmployeeStats);

export default router;
