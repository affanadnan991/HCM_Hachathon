import express from 'express';
import { aiController } from '../controllers/aiController.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

router.use(authGuard);

router.post('/chat', aiController.chat);
router.post('/summarize', aiController.summarize);
router.get('/logs', roleGuard('ADMIN', 'HR'), aiController.getAiLogs);

export default router;
