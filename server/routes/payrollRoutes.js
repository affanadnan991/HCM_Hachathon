import express from 'express';
import { payrollController } from '../controllers/payrollController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

router.use(authGuard);

// Run Management
router.post('/runs/draft', roleGuard('ADMIN', 'HR'), payrollController.createDraft);
router.post('/runs/:id/finalize', roleGuard('ADMIN'), payrollController.finalizeRun);
router.get('/runs', roleGuard('ADMIN', 'HR'), payrollController.getRuns);
router.get('/runs/:id', roleGuard('ADMIN', 'HR'), payrollController.getRunById);

// Payslips (Employee self-service & Admin/HR view)
router.get('/my-payslips', payrollController.getMyPayslips);
router.get('/payslips/:id', payrollController.getPayslip);
router.get('/payslips/:id/pdf', payrollController.downloadPdf);

export default router;
