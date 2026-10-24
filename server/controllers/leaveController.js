import { leaveService } from '../services/leaveService.js';

export const leaveController = {
  getBalances(req, res) {
    try {
      const employeeId = req.user.role === 'EMPLOYEE' ? req.user.employee_id : (req.query.employee_id || req.user.employee_id);
      if (!employeeId) {
        return res.status(400).json({ error: 'No associated employee profile.' });
      }
      const { year } = req.query;
      const balances = leaveService.getLeaveBalances(employeeId, year ? Number(year) : undefined);
      res.json(balances);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  applyLeave(req, res) {
    try {
      const employeeId = req.user.role === 'EMPLOYEE' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);
      if (!employeeId) {
        return res.status(400).json({ error: 'No associated employee profile found.' });
      }

      const { leaveTypeId, startDate, endDate, reason } = req.body;
      const created = leaveService.applyLeave({
        employeeId,
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate,
        reason
      }, req.user);

      res.status(201).json(created);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({ error: err.message });
    }
  },

  cancelLeave(req, res) {
    try {
      const result = leaveService.cancelLeave(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      const status = err.message.includes('Forbidden') ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  },

  getLeaveRequests(req, res) {
    try {
      const { status, employeeId, department_id } = req.query;
      const list = leaveService.getLeaveRequests({
        status,
        employeeId: employeeId ? Number(employeeId) : null,
        department_id: department_id ? Number(department_id) : null
      }, req.user);
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  reviewLeave(req, res) {
    try {
      const { status, reviewComment } = req.body;
      const result = leaveService.reviewLeaveRequest({
        leaveId: req.params.id,
        status,
        reviewComment
      }, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};
