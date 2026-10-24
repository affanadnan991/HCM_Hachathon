import { authService } from '../services/authService.js';

export const authController = {
  getSetupStatus(req, res) {
    try {
      const status = authService.checkFirstRunStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  setupFirstRun(req, res) {
    try {
      const { companyName, adminEmail, adminPassword, officeStartTime, gracePeriod, halfDayHours, weekendDays, officeLat, officeLng, officeRadius } = req.body;
      const result = authService.bootstrapAdmin({
        companyName,
        adminEmail,
        adminPassword,
        officeStartTime,
        gracePeriod,
        halfDayHours,
        weekendDays,
        officeLat,
        officeLng,
        officeRadius
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  login(req, res) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const result = authService.login({ email, password, ipAddress });
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  },

  getCurrentUser(req, res) {
    try {
      res.json({ user: req.user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = authService.changePassword({
        userId: req.user.id,
        currentPassword,
        newPassword,
        actorRole: req.user.role
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  createHr(req, res) {
    try {
      const { email, password } = req.body;
      const result = authService.createHrUser({ email, password }, req.user);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  resetPassword(req, res) {
    try {
      const { targetUserId, tempPassword } = req.body;
      const result = authService.resetUserPassword({ targetUserId, tempPassword }, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  toggleUserStatus(req, res) {
    try {
      const { targetUserId, isActive } = req.body;
      const result = authService.toggleUserStatus({ targetUserId, isActive }, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  listUsers(req, res) {
    try {
      const { role } = req.query;
      const users = authService.listUsers({ role });
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
