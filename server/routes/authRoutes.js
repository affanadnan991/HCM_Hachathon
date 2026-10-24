import express from 'express';
import { authController } from '../controllers/authController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

// Public Routes
router.get('/setup-status', authController.getSetupStatus);
router.post('/setup', authController.setupFirstRun);
router.post('/login', authController.login);

// Protected Routes (Any Authenticated User)
router.get('/me', authGuard, authController.getCurrentUser);
router.post('/change-password', authGuard, authController.changePassword);

// Admin Only Routes
router.post('/create-hr', authGuard, roleGuard('ADMIN'), authController.createHr);
router.post('/reset-password', authGuard, roleGuard('ADMIN'), authController.resetPassword);
router.post('/toggle-status', authGuard, roleGuard('ADMIN'), authController.toggleUserStatus);
router.get('/users', authGuard, roleGuard('ADMIN'), authController.listUsers);

export default router;
