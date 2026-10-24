import { attendanceService } from '../services/attendanceService.js';

export const attendanceController = {
  checkIn(req, res) {
    try {
      const employeeId = req.user.role === 'EMPLOYEE' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);
      if (!employeeId) {
        return res.status(400).json({ error: 'No associated employee profile found for check-in.' });
      }

      const { source = 'web', lat = null, lng = null } = req.body;
      const record = attendanceService.checkIn({ employeeId, source, lat, lng }, req.user);
      res.status(201).json(record);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({ error: err.message });
    }
  },

  checkOut(req, res) {
    try {
      const employeeId = req.user.role === 'EMPLOYEE' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);
      if (!employeeId) {
        return res.status(400).json({ error: 'No associated employee profile found.' });
      }

      const { lat = null, lng = null } = req.body;
      const record = attendanceService.checkOut({ employeeId, lat, lng }, req.user);
      res.json(record);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  getTodayStatus(req, res) {
    try {
      const employeeId = req.user.role === 'EMPLOYEE' ? req.user.employee_id : req.query.employee_id;
      if (!employeeId) {
        return res.json({ status: null, checked_in: false });
      }
      const record = attendanceService.getTodayStatus(employeeId);
      res.json({
        checked_in: Boolean(record),
        checked_out: Boolean(record?.check_out_time),
        record
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getDailyBoard(req, res) {
    try {
      const { date, department_id } = req.query;
      const board = attendanceService.getDailyBoard({
        date,
        department_id: department_id ? Number(department_id) : null
      });
      res.json(board);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getHistory(req, res) {
    try {
      const employeeId = req.user.role === 'EMPLOYEE' ? req.user.employee_id : (req.query.employee_id || req.user.employee_id);
      const { month, year } = req.query;
      const history = attendanceService.getEmployeeHistory(employeeId, { month, year }, req.user);
      res.json(history);
    } catch (err) {
      res.status(err.message.includes('Forbidden') ? 403 : 500).json({ error: err.message });
    }
  },

  requestCorrection(req, res) {
    try {
      const employeeId = req.user.role === 'EMPLOYEE' ? req.user.employee_id : req.body.employee_id;
      const { attendanceId, requestedCheckIn, requestedCheckOut, reason } = req.body;
      const result = attendanceService.requestCorrection({
        attendanceId,
        employeeId,
        requestedCheckIn,
        requestedCheckOut,
        reason
      }, req.user);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  getCorrectionRequests(req, res) {
    try {
      const { status } = req.query;
      const list = attendanceService.getCorrectionRequests(status);
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  reviewCorrection(req, res) {
    try {
      const { status, reviewComment } = req.body;
      const result = attendanceService.reviewCorrection({
        correctionId: req.params.id,
        status,
        reviewComment
      }, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};
