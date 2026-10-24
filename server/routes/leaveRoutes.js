import express from 'express';
import { leaveController } from '../controllers/leaveController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

router.use(authGuard);

router.get('/balances', leaveController.getBalances);
router.post('/apply', leaveController.applyLeave);
router.post('/:id/cancel', leaveController.cancelLeave);
router.get('/', leaveController.getLeaveRequests);
router.post('/:id/review', roleGuard('ADMIN', 'HR'), leaveController.reviewLeave);

export default router;
