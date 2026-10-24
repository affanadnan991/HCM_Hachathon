import express from 'express';
import { attendanceController } from '../controllers/attendanceController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

router.use(authGuard);

// Punch Actions
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/today-status', attendanceController.getTodayStatus);
router.get('/history', attendanceController.getHistory);

// Daily Board (HR & Admin)
router.get('/daily-board', roleGuard('ADMIN', 'HR'), attendanceController.getDailyBoard);

// Attendance Corrections
router.post('/corrections', attendanceController.requestCorrection);
router.get('/corrections', roleGuard('ADMIN', 'HR'), attendanceController.getCorrectionRequests);
router.post('/corrections/:id/review', roleGuard('ADMIN', 'HR'), attendanceController.reviewCorrection);

export default router;
