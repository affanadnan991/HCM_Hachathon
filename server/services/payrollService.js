import db from '../config/db.js';
import { dateUtils } from '../utils/dateUtils.js';
import { companyService } from './companyService.js';
import { auditService } from './auditService.js';

export const payrollService = {
  // Tax Slab Engine (Annualized Gross x 12)
  calculateTax(annualGross) {
    let annualTax = 0;

    if (annualGross <= 600000) {
      annualTax = 0;
    } else if (annualGross <= 1200000) {
      annualTax = (annualGross - 600000) * 0.05;
    } else if (annualGross <= 2400000) {
      annualTax = 30000 + (annualGross - 1200000) * 0.15;
    } else if (annualGross <= 3600000) {
      annualTax = 210000 + (annualGross - 2400000) * 0.25;
    } else {
      annualTax = 510000 + (annualGross - 3600000) * 0.35;
    }

    return Math.round(annualTax / 12);
  },

  // Generate Monthly Payroll Draft (HR or Admin)
  generateMonthlyDraft({ month, year }, actorUser) {
    if (!month || !year) {
      throw new Error('Month and year are required.');
    }

    // Check if finalized run already exists (Locking rule)
    const existingRun = db.prepare(`SELECT * FROM payroll_runs WHERE month = ? AND year = ?`).get(month, year);
    if (existingRun && existingRun.status === 'FINALIZED') {
      const err = new Error(`403 Forbidden: Payroll for ${month}/${year} is finalized and locked. It cannot be recalculated or modified.`);
      err.status = 403;
      throw err;
    }

    const settings = companyService.getSettings();

    // 1. Calculate month boundaries & total working days in the month
    const monthStr = String(month).padStart(2, '0');
    const startOfMonth = `${year}-${monthStr}-01`;
    // Last day of month
    const lastDayNum = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${monthStr}-${String(lastDayNum).padStart(2, '0')}`;

    const totalMonthWorkingDays = dateUtils.calculateWorkingDays(startOfMonth, endOfMonth, settings.weekend_days);

    // 2. Fetch all active employees
    const employees = db.prepare(`
      SELECT * FROM employees 
      WHERE employment_status != 'Terminated' 
        AND date_of_joining <= ?
        AND (date_of_exit IS NULL OR date_of_exit >= ?)
    `).all(endOfMonth, startOfMonth);

    if (employees.length === 0) {
      throw new Error('No active employees found to run payroll.');
    }

    const transaction = db.transaction(() => {
      // Clean up previous draft for this month if exists
      if (existingRun) {
        db.prepare(`DELETE FROM payslips WHERE payroll_run_id = ?`).run(existingRun.id);
        db.prepare(`DELETE FROM payroll_runs WHERE id = ?`).run(existingRun.id);
      }

      // Create Run Record
      const runResult = db.prepare(`
        INSERT INTO payroll_runs (
          month, year, status, total_employees, total_gross,
          total_deductions, total_tax, total_net, created_by
        ) VALUES (?, ?, 'DRAFT', ?, 0, 0, 0, 0, ?)
      `).run(month, year, employees.length, actorUser.id);

      const runId = runResult.lastInsertRowid;

      let sumGross = 0;
      let sumDeductions = 0;
      let sumTax = 0;
      let sumNet = 0;

      for (const emp of employees) {
        // Prorating: check if joined after start of month or exited before end of month
        const effectiveStart = emp.date_of_joining > startOfMonth ? emp.date_of_joining : startOfMonth;
        const effectiveEnd = (emp.date_of_exit && emp.date_of_exit < endOfMonth) ? emp.date_of_exit : endOfMonth;
        const eligibleWorkingDays = dateUtils.calculateWorkingDays(effectiveStart, effectiveEnd, settings.weekend_days);

        // Fetch attendance for this employee in this month
        const attendanceRecords = db.prepare(`
          SELECT * FROM attendance 
          WHERE employee_id = ? AND date BETWEEN ? AND ?
        `).all(emp.id, startOfMonth, endOfMonth);

        const presentCount = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
        const lateCount = attendanceRecords.filter(a => a.status === 'late').length;
        const halfDayCount = attendanceRecords.filter(a => a.status === 'half_day').length;

        // Fetch approved leaves in this month
        const approvedLeaves = db.prepare(`
          SELECT lr.*, lt.is_paid 
          FROM leave_requests lr
          JOIN leave_types lt ON lr.leave_type_id = lt.id
          WHERE lr.employee_id = ? 
            AND lr.status = 'APPROVED'
            AND lr.start_date <= ? AND lr.end_date >= ?
        `).all(emp.id, endOfMonth, startOfMonth);

        let paidLeaveDays = 0;
        let unpaidLeaveDays = 0;

        for (const l of approvedLeaves) {
          const lStart = l.start_date > startOfMonth ? l.start_date : startOfMonth;
          const lEnd = l.end_date < endOfMonth ? l.end_date : endOfMonth;
          const lDays = dateUtils.calculateWorkingDays(lStart, lEnd, settings.weekend_days);
          if (l.is_paid === 1) {
            paidLeaveDays += lDays;
          } else {
            unpaidLeaveDays += lDays;
          }
        }

        // Calculate absent days
        const accountedDays = presentCount + halfDayCount + paidLeaveDays + unpaidLeaveDays;
        const absentDays = Math.max(0, eligibleWorkingDays - accountedDays);

        // Calculations per hackathon formulas:
        const basic = emp.basic_salary;
        const hra = Number((basic * 0.40).toFixed(2));
        const medical = Number((basic * 0.10).toFixed(2));
        const gross = Number((basic * 1.50).toFixed(2));

        const perDayRate = totalMonthWorkingDays > 0 ? (gross / totalMonthWorkingDays) : 0;

        const unpaidDeduction = Number(((absentDays + unpaidLeaveDays) * perDayRate).toFixed(2));
        const halfDayDeduction = Number(((0.5 * halfDayCount) * perDayRate).toFixed(2));

        // Bonus: Automatic 3-Late = 0.5 Day wage penalty rule
        const latePenaltyDeduction = Number((Math.floor(lateCount / 3) * 0.5 * perDayRate).toFixed(2));

        const attendanceDeductions = unpaidDeduction + halfDayDeduction + latePenaltyDeduction;

        // Income tax on annualized gross
        const annualGross = gross * 12;
        const monthlyTax = this.calculateTax(annualGross);

        const totalDeductions = Number((attendanceDeductions + monthlyTax).toFixed(2));
        const netSalary = Math.max(0, Number((gross - totalDeductions).toFixed(2)));
        const daysWorked = Math.max(0, eligibleWorkingDays - absentDays - unpaidLeaveDays - (0.5 * halfDayCount));

        // Insert Payslip
        db.prepare(`
          INSERT INTO payslips (
            payroll_run_id, employee_id, basic_salary, hra_allowance,
            medical_allowance, gross_salary, working_days_in_month,
            days_worked, absent_days, unpaid_leave_days, half_days,
            unpaid_deduction, half_day_deduction, tax_deduction,
            total_deductions, net_salary, late_penalty_deduction, late_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          runId, emp.id, basic, hra, medical, gross,
          totalMonthWorkingDays, daysWorked, absentDays, unpaidLeaveDays,
          halfDayCount, unpaidDeduction, halfDayDeduction, monthlyTax,
          totalDeductions, netSalary, latePenaltyDeduction, lateCount
        );

        sumGross += gross;
        sumDeductions += totalDeductions;
        sumTax += monthlyTax;
        sumNet += netSalary;
      }

      // Update Payroll Run Totals
      db.prepare(`
        UPDATE payroll_runs
        SET total_gross = ?, total_deductions = ?, total_tax = ?, total_net = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(sumGross, sumDeductions, sumTax, sumNet, runId);

      auditService.logAction({
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: 'CREATE_PAYROLL_DRAFT',
        entity: 'PAYROLL_RUN',
        entityId: String(runId),
        afterJson: { month, year, employees: employees.length, sumGross, sumNet }
      });

      return this.getPayrollRunById(runId);
    });

    return transaction();
  },

  // Finalize Payroll Run (Admin Only - Locks the month)
  finalizePayrollRun(runId, actorUser) {
    const run = db.prepare(`SELECT * FROM payroll_runs WHERE id = ?`).get(runId);
    if (!run) {
      throw new Error('Payroll run not found.');
    }

    if (run.status === 'FINALIZED') {
      throw new Error('This payroll run is already finalized and locked.');
    }

    const transaction = db.transaction(() => {
      const nowIso = new Date().toISOString();

      db.prepare(`
        UPDATE payroll_runs
        SET status = 'FINALIZED', finalized_by = ?, finalized_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(actorUser.id, nowIso, runId);

      // Notify all active employees that their payslip is available
      const payslips = db.prepare(`
        SELECT p.id, e.user_id 
        FROM payslips p 
        JOIN employees e ON p.employee_id = e.id 
        WHERE p.payroll_run_id = ?
      `).all(runId);

      for (const p of payslips) {
        if (p.user_id) {
          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, 'PAYROLL')
          `).run(
            p.user_id,
            `Payslip Ready (${run.month}/${run.year})`,
            `Your monthly salary payslip for ${run.month}/${run.year} is now finalized and available for download.`
          );
        }
      }

      auditService.logAction({
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: 'FINALIZE_PAYROLL',
        entity: 'PAYROLL_RUN',
        entityId: String(runId),
        beforeJson: { status: 'DRAFT' },
        afterJson: { status: 'FINALIZED', finalizedAt: nowIso }
      });

      return this.getPayrollRunById(runId);
    });

    return transaction();
  },

  // Get Payroll Run by ID with Payslips
  getPayrollRunById(runId) {
    const run = db.prepare(`
      SELECT pr.*, 
             u1.email as created_by_email,
             u2.email as finalized_by_email
      FROM payroll_runs pr
      LEFT JOIN users u1 ON pr.created_by = u1.id
      LEFT JOIN users u2 ON pr.finalized_by = u2.id
      WHERE pr.id = ?
    `).get(runId);

    if (!run) return null;

    const payslips = db.prepare(`
      SELECT p.*, e.employee_code, e.first_name, e.last_name, e.email,
             d.name as department_name, des.title as designation_title
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE p.payroll_run_id = ?
      ORDER BY e.employee_code ASC
    `).all(runId);

    return { ...run, payslips };
  },

  // List Payroll Runs
  getPayrollRuns() {
    return db.prepare(`
      SELECT pr.*, 
             u1.email as created_by_email,
             u2.email as finalized_by_email
      FROM payroll_runs pr
      LEFT JOIN users u1 ON pr.created_by = u1.id
      LEFT JOIN users u2 ON pr.finalized_by = u2.id
      ORDER BY pr.year DESC, pr.month DESC
    `).all();
  },

  // Get Payslip by ID (Scoped)
  getPayslipById(payslipId, requestingUser) {
    const payslip = db.prepare(`
      SELECT p.*, pr.month, pr.year, pr.status as run_status,
             e.employee_code, e.first_name, e.last_name, e.email,
             d.name as department_name, des.title as designation_title
      FROM payslips p
      JOIN payroll_runs pr ON p.payroll_run_id = pr.id
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE p.id = ?
    `).get(payslipId);

    if (!payslip) {
      throw new Error('Payslip not found.');
    }

    if (requestingUser.role === 'EMPLOYEE' && Number(payslip.employee_id) !== Number(requestingUser.employee_id)) {
      throw new Error('Forbidden: You can only view your own payslip.');
    }

    return payslip;
  },

  // Get Employee Payslips List (Scoped)
  getEmployeePayslips(employeeId, requestingUser) {
    if (requestingUser.role === 'EMPLOYEE' && Number(employeeId) !== Number(requestingUser.employee_id)) {
      throw new Error('Forbidden: Employees can only view their own payslips.');
    }

    return db.prepare(`
      SELECT p.*, pr.month, pr.year, pr.status as run_status
      FROM payslips p
      JOIN payroll_runs pr ON p.payroll_run_id = pr.id
      WHERE p.employee_id = ?
      ORDER BY pr.year DESC, pr.month DESC
    `).all(employeeId);
  }
};
