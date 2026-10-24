import { companyService } from '../services/companyService.js';

export const companyController = {
  getSettings(req, res) {
    try {
      const settings = companyService.getSettings();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  updateSettings(req, res) {
    try {
      const updated = companyService.updateSettings(req.body, req.user);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  getDepartments(req, res) {
    try {
      const depts = companyService.getDepartments();
      res.json(depts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  createDepartment(req, res) {
    try {
      const created = companyService.createDepartment(req.body, req.user);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  deleteDepartment(req, res) {
    try {
      const result = companyService.deleteDepartment(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  getDesignations(req, res) {
    try {
      const { department_id } = req.query;
      const desigs = companyService.getDesignations(department_id);
      res.json(desigs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  createDesignation(req, res) {
    try {
      const created = companyService.createDesignation(req.body, req.user);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  deleteDesignation(req, res) {
    try {
      const result = companyService.deleteDesignation(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  getLeaveTypes(req, res) {
    try {
      const leaveTypes = companyService.getLeaveTypes();
      res.json(leaveTypes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  updateLeaveType(req, res) {
    try {
      const updated = companyService.updateLeaveType(req.params.id, req.body, req.user);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  getHolidays(req, res) {
    try {
      const { year } = req.query;
      const holidays = companyService.getHolidays(year);
      res.json(holidays);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  createHoliday(req, res) {
    try {
      const created = companyService.createHoliday(req.body, req.user);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  deleteHoliday(req, res) {
    try {
      const result = companyService.deleteHoliday(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};
