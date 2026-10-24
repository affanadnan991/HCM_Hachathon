import { payrollService } from '../services/payrollService.js';
import { companyService } from '../services/companyService.js';
import { generatePayslipPdf } from '../utils/pdfGenerator.js';

export const payrollController = {
  createDraft(req, res) {
    try {
      const { month, year } = req.body;
      const run = payrollService.generateMonthlyDraft({
        month: Number(month),
        year: Number(year)
      }, req.user);
      res.status(201).json(run);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({ error: err.message });
    }
  },

  finalizeRun(req, res) {
    try {
      const finalized = payrollService.finalizePayrollRun(req.params.id, req.user);
      res.json(finalized);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({ error: err.message });
    }
  },

  getRuns(req, res) {
    try {
      const runs = payrollService.getPayrollRuns();
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getRunById(req, res) {
    try {
      const run = payrollService.getPayrollRunById(req.params.id);
      if (!run) {
        return res.status(404).json({ error: 'Payroll run not found.' });
      }
      res.json(run);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getMyPayslips(req, res) {
    try {
      const employeeId = req.user.employee_id;
      if (!employeeId) {
        return res.json([]);
      }
      const payslips = payrollService.getEmployeePayslips(employeeId, req.user);
      res.json(payslips);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getPayslip(req, res) {
    try {
      const payslip = payrollService.getPayslipById(req.params.id, req.user);
      res.json(payslip);
    } catch (err) {
      const status = err.message.includes('Forbidden') ? 403 : 404;
      res.status(status).json({ error: err.message });
    }
  },

  downloadPdf(req, res) {
    try {
      const payslip = payrollService.getPayslipById(req.params.id, req.user);
      const companySettings = companyService.getSettings();

      generatePayslipPdf(payslip, companySettings, (err, pdfBuffer) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to generate PDF.' });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="payslip_${payslip.employee_code}_${payslip.month}_${payslip.year}.pdf"`);
        res.send(pdfBuffer);
      });
    } catch (err) {
      const status = err.message.includes('Forbidden') ? 403 : 404;
      res.status(status).json({ error: err.message });
    }
  }
};
