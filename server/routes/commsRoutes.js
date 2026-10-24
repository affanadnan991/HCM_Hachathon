import express from 'express';
import { commsController } from '../controllers/commsController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

router.use(authGuard);

// Announcements (Admin & HR post/delete, All can read)
router.get('/announcements', commsController.getAnnouncements);
router.post('/announcements', roleGuard('ADMIN', 'HR'), commsController.createAnnouncement);
router.delete('/announcements/:id', roleGuard('ADMIN', 'HR'), commsController.deleteAnnouncement);

// In-App Notifications (Current User)
router.get('/notifications', commsController.getNotifications);
router.post('/notifications/:id/read', commsController.markRead);
router.post('/notifications/mark-all-read', commsController.markAllRead);

export default router;
