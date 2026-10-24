import express from 'express';
import { employeeController } from '../controllers/employeeController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

router.use(authGuard);

// CSV Management (HR & Admin only)
router.post('/csv-dry-run', roleGuard('ADMIN', 'HR'), employeeController.dryRunCsv);
router.post('/csv-import', roleGuard('ADMIN', 'HR'), employeeController.commitCsvImport);
router.get('/csv-export', roleGuard('ADMIN', 'HR'), employeeController.exportCsv);

// Employee CRUD
router.get('/', employeeController.getEmployees);
router.post('/', roleGuard('ADMIN', 'HR'), employeeController.registerEmployee);
router.get('/:id', employeeController.getEmployeeById);
router.put('/:id', employeeController.updateEmployee);

export default router;
