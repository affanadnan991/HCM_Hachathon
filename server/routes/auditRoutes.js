import express from 'express';
import { auditService } from '../services/auditService.js';
import { authGuard, roleGuard } from '../middleware/authGuard.js';

const router = express.Router();

// Only Admin can view the audit log
router.get('/', authGuard, roleGuard('ADMIN'), (req, res) => {
  try {
    const { limit = 50, offset = 0, entity, actorId } = req.query;
    const logs = auditService.getAuditLogs({
      limit: Number(limit),
      offset: Number(offset),
      entity,
      actorId: actorId ? Number(actorId) : null
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
