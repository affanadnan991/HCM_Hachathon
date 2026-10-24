import { employeeService } from '../services/employeeService.js';

export const employeeController = {
  getEmployees(req, res) {
    try {
      const { search, department_id, status, page, limit } = req.query;
      const data = employeeService.getEmployees({
        search,
        department_id,
        status,
        page,
        limit
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getEmployeeById(req, res) {
    try {
      const employee = employeeService.getEmployeeById(req.params.id, req.user);
      res.json(employee);
    } catch (err) {
      const status = err.message.includes('Forbidden') ? 403 : 404;
      res.status(status).json({ error: err.message });
    }
  },

  registerEmployee(req, res) {
    try {
      const employee = employeeService.registerEmployee(req.body, req.user);
      res.status(201).json(employee);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  updateEmployee(req, res) {
    try {
      const updated = employeeService.updateEmployee(req.params.id, req.body, req.user);
      res.json(updated);
    } catch (err) {
      const status = err.message.includes('Forbidden') ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  },

  dryRunCsv(req, res) {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No CSV rows provided.' });
      }
      const report = employeeService.dryRunCsvImport(rows);
      res.json(report);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  commitCsvImport(req, res) {
    try {
      const { validRows } = req.body;
      if (!Array.isArray(validRows) || validRows.length === 0) {
        return res.status(400).json({ error: 'No valid rows provided to import.' });
      }
      const results = employeeService.commitCsvImport(validRows, req.user);
      res.status(201).json({
        success: true,
        imported_count: results.length,
        employees: results
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  exportCsv(req, res) {
    try {
      const csvData = employeeService.exportEmployeesCsv();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="employees_export.csv"');
      res.send(csvData);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
