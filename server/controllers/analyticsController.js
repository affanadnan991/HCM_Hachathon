import { analyticsService } from '../services/analyticsService.js';

export const analyticsController = {
  getAdminStats(req, res) {
    try {
      const { startDate, endDate, departmentId } = req.query;
      const stats = analyticsService.getAdminAnalytics({
        startDate,
        endDate,
        departmentId: departmentId ? Number(departmentId) : null
      });
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getHrStats(req, res) {
    try {
      const { date, departmentId } = req.query;
      const stats = analyticsService.getHrAnalytics({
        date,
        departmentId: departmentId ? Number(departmentId) : null
      });
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getEmployeeStats(req, res) {
    try {
      const employeeId = req.user.employee_id;
      if (!employeeId) {
        return res.status(400).json({ error: 'No associated employee profile.' });
      }
      const stats = analyticsService.getEmployeeAnalytics(employeeId);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
