import express from 'express';
import { companyController } from '../controllers/companyController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

// All company routes require authentication (Admin or HR)
router.use(authGuard);

// Settings
router.get('/settings', roleGuard('ADMIN', 'HR'), companyController.getSettings);
router.put('/settings', roleGuard('ADMIN'), companyController.updateSettings);

// Departments
router.get('/departments', roleGuard('ADMIN', 'HR'), companyController.getDepartments);
router.post('/departments', roleGuard('ADMIN'), companyController.createDepartment);
router.delete('/departments/:id', roleGuard('ADMIN'), companyController.deleteDepartment);

// Designations
router.get('/designations', roleGuard('ADMIN', 'HR'), companyController.getDesignations);
router.post('/designations', roleGuard('ADMIN'), companyController.createDesignation);
router.delete('/designations/:id', roleGuard('ADMIN'), companyController.deleteDesignation);

// Leave Types & Quotas
router.get('/leave-types', roleGuard('ADMIN', 'HR', 'EMPLOYEE'), companyController.getLeaveTypes);
router.put('/leave-types/:id', roleGuard('ADMIN'), companyController.updateLeaveType);

// Holidays
router.get('/holidays', roleGuard('ADMIN', 'HR', 'EMPLOYEE'), companyController.getHolidays);
router.post('/holidays', roleGuard('ADMIN'), companyController.createHoliday);
router.delete('/holidays/:id', roleGuard('ADMIN'), companyController.deleteHoliday);

export default router;
