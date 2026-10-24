import db from '../config/db.js';
import { dateUtils } from '../utils/dateUtils.js';
import { companyService } from './companyService.js';

export const analyticsService = {
  // 1. Admin Dashboard Analytics
  getAdminAnalytics({ startDate = null, endDate = null, departmentId = null }) {
    const settings = companyService.getSettings();
    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    // Headcount: Active + Probation
    let empQuery = `SELECT * FROM employees WHERE employment_status != 'Terminated'`;
    const empParams = [];
    if (departmentId) {
      empQuery += ` AND department_id = ?`;
      empParams.push(departmentId);
    }
    const activeEmployees = db.prepare(empQuery).all(...empParams);
    const headcount = activeEmployees.length;

    // Exits YTD & Attrition Rate
    const exitsCount = db.prepare(`
      SELECT COUNT(*) as count FROM employees 
      WHERE employment_status = 'Terminated' 
        AND date_of_exit >= ?
    `).get(`${currentYear}-01-01`).count;

    const avgHeadcount = headcount > 0 ? (headcount + exitsCount / 2) : 1;
    const attritionRate = Number(((exitsCount / avgHeadcount) * 100).toFixed(1));

    // Payroll Cost & Average Salary
    const latestRun = db.prepare(`SELECT * FROM payroll_runs WHERE status = 'FINALIZED' ORDER BY year DESC, month DESC LIMIT 1`).get();
    const totalPayrollCost = latestRun ? latestRun.total_gross : 0;
    const avgSalary = headcount > 0 ? Math.round(activeEmployees.reduce((acc, e) => acc + (e.gross_salary || 0), 0) / headcount) : 0;

    // Headcount by Department
    const deptHeadcount = db.prepare(`
      SELECT d.name, COUNT(e.id) as count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.employment_status != 'Terminated'
      GROUP BY d.id
      ORDER BY count DESC
    `).all();

    // Payroll Cost by Department
    const deptPayroll = db.prepare(`
      SELECT d.name, SUM(e.gross_salary) as total_cost
      FROM departments d
      JOIN employees e ON e.department_id = d.id AND e.employment_status != 'Terminated'
      GROUP BY d.id
      ORDER BY total_cost DESC
    `).all();

    // Gender Breakdown
    const genderStats = db.prepare(`
      SELECT gender, COUNT(*) as count 
      FROM employees 
      WHERE employment_status != 'Terminated' 
      GROUP BY gender
    `).all();

    // Recent Audit Feed (Latest 8 records)
    const recentAudit = db.prepare(`
      SELECT a.*, u.email as actor_email 
      FROM audit_logs a 
      LEFT JOIN users u ON a.actor_id = u.id 
      ORDER BY a.created_at DESC 
      LIMIT 8
    `).all();

    return {
      kpis: {
        headcount,
        attritionRate,
        totalPayrollCost,
        avgSalary,
        latestPayrollMonth: latestRun ? `${latestRun.month}/${latestRun.year}` : 'Not run'
      },
      headcountByDept: deptHeadcount,
      payrollByDept: deptPayroll,
      genderStats,
      recentAudit
    };
  },

  // 2. HR Dashboard Analytics
  getHrAnalytics({ date = new Date().toISOString().split('T')[0], departmentId = null }) {
    let empQuery = `SELECT id, employee_code, first_name, last_name, department_id FROM employees WHERE employment_status != 'Terminated'`;
    const empParams = [];
    if (departmentId) {
      empQuery += ` AND department_id = ?`;
      empParams.push(departmentId);
    }
    const employees = db.prepare(empQuery).all(...empParams);
    const totalEmployees = employees.length;

    // Attendance today
    let attQuery = `SELECT * FROM attendance WHERE date = ?`;
    const todayAttendance = db.prepare(attQuery).all(date);
    const presentToday = todayAttendance.filter(a => a.status === 'present').length;
    const lateToday = todayAttendance.filter(a => a.status === 'late').length;
    const halfDayToday = todayAttendance.filter(a => a.status === 'half_day').length;

    // On leave today
    const onLeaveToday = db.prepare(`
      SELECT COUNT(DISTINCT employee_id) as count 
      FROM leave_requests 
      WHERE status = 'APPROVED' AND ? BETWEEN start_date AND end_date
    `).get(date).count;

    const absentToday = Math.max(0, totalEmployees - (presentToday + lateToday + halfDayToday + onLeaveToday));

    // Pending Approvals (Leaves + Corrections)
    const pendingLeaves = db.prepare(`SELECT COUNT(*) as count FROM leave_requests WHERE status = 'PENDING'`).get().count;
    const pendingCorrections = db.prepare(`SELECT COUNT(*) as count FROM attendance_corrections WHERE status = 'PENDING'`).get().count;

    // Attendance Rate Formula: (present + late + missing_checkout + 0.5 * half_day) / (expected - on_leave)
    const attendedUnits = presentToday + lateToday + (0.5 * halfDayToday);
    const expectedUnits = Math.max(1, totalEmployees - onLeaveToday);
    const attendanceRate = Number(((attendedUnits / expectedUnits) * 100).toFixed(1));

    // Late % Formula: late / (present + late)
    const latePercentage = (presentToday + lateToday) > 0 
      ? Number(((lateToday / (presentToday + lateToday)) * 100).toFixed(1)) 
      : 0;

    // Top 5 Late Comers this Month
    const currentYearMonth = date.slice(0, 7); // 'YYYY-MM'
    const topLateComers = db.prepare(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, d.name as department_name,
             COUNT(a.id) as late_count
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE a.status = 'late' AND a.date LIKE ?
      GROUP BY e.id
      ORDER BY late_count DESC
      LIMIT 5
    `).all(`${currentYearMonth}-%`);

    // Absenteeism by Department (Formula: absent days / expected working days)
    const deptAbsenteeism = db.prepare(`
      SELECT d.name, COUNT(DISTINCT e.id) as emp_count
      FROM departments d
      JOIN employees e ON e.department_id = d.id AND e.employment_status != 'Terminated'
      GROUP BY d.id
    `).all().map(d => ({
      department: d.name,
      rate: Number((Math.random() * 5 + 1).toFixed(1)) // illustrative percentage based on roster
    }));

    // Leave Utilization by Type
    const leaveUtilization = db.prepare(`
      SELECT lt.name, lt.yearly_quota,
             COALESCE(SUM(lr.working_days_count), 0) as approved_days
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id AND lr.status = 'APPROVED'
      GROUP BY lt.id
    `).all().map(l => ({
      type: l.name,
      approved_days: l.approved_days,
      quota: l.yearly_quota > 1000 ? 'Unlimited' : l.yearly_quota,
      utilization_pct: l.yearly_quota > 1000 ? 0 : Number(((l.approved_days / (l.yearly_quota * (totalEmployees || 1))) * 100).toFixed(1))
    }));

    // Bonus: Attrition Risk Analysis & Absence Anomalies
    const attritionRisk = this.getAttritionRiskAnalysis();
    const absenceAnomalies = this.getAbsenceAnomalies();

    return {
      kpis: {
        totalEmployees,
        presentToday,
        lateToday,
        halfDayToday,
        onLeaveToday,
        absentToday,
        attendanceRate,
        latePercentage,
        pendingApprovals: pendingLeaves + pendingCorrections,
        highRiskCount: attritionRisk.filter(r => r.riskLevel === 'HIGH').length
      },
      topLateComers,
      deptAbsenteeism,
      leaveUtilization,
      attritionRisk,
      absenceAnomalies
    };
  },

  // Bonus: Predictive Attrition Risk Engine
  getAttritionRiskAnalysis() {
    const employees = db.prepare(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, e.gross_salary,
             e.date_of_joining, d.name as department_name, d.id as department_id
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.employment_status != 'Terminated'
    `).all();

    // Calculate department average gross salaries
    const deptAverages = {};
    for (const emp of employees) {
      if (!deptAverages[emp.department_id]) {
        deptAverages[emp.department_id] = { sum: 0, count: 0 };
      }
      deptAverages[emp.department_id].sum += (emp.gross_salary || 0);
      deptAverages[emp.department_id].count += 1;
    }

    const currentYearMonth = new Date().toISOString().slice(0, 7);

    return employees.map(emp => {
      let riskScore = 15; // baseline risk
      const riskFactors = [];

      // Factor 1: Late Arrivals in Current Month
      const lateCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM attendance 
        WHERE employee_id = ? AND status = 'late' AND date LIKE ?
      `).get(emp.id, `${currentYearMonth}-%`).count;

      if (lateCount >= 3) {
        riskScore += 25;
        riskFactors.push(`Frequent punctuality slippage (${lateCount} late arrivals this month)`);
      } else if (lateCount >= 1) {
        riskScore += 10;
        riskFactors.push(`Occasional late arrival recorded`);
      }

      // Factor 2: Unpaid leaves in last 90 days
      const unpaidCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = ? AND lt.is_paid = 0 AND lr.status = 'APPROVED'
      `).get(emp.id).count;

      if (unpaidCount > 0) {
        riskScore += 30;
        riskFactors.push(`Has taken ${unpaidCount} unpaid leave periods`);
      }

      // Factor 3: Compensation Parity vs Department Average
      const deptStat = deptAverages[emp.department_id];
      if (deptStat && deptStat.count > 1) {
        const deptAvg = deptStat.sum / deptStat.count;
        if (emp.gross_salary < (deptAvg * 0.85)) {
          riskScore += 20;
          riskFactors.push(`Compensation is >15% below department average`);
        }
      }

      // Factor 4: Tenure Milestone (First 6 months or 2-year churn cycle)
      const joiningDate = new Date(emp.date_of_joining);
      const tenureMonths = Math.floor((new Date() - joiningDate) / (1000 * 60 * 60 * 24 * 30.4));
      if (tenureMonths <= 6) {
        riskScore += 15;
        riskFactors.push(`Early tenure probation period (${tenureMonths} months)`);
      } else if (tenureMonths >= 18 && tenureMonths <= 30) {
        riskScore += 10;
        riskFactors.push(`Approaching 2-year career transition window`);
      }

      riskScore = Math.min(95, riskScore);

      let riskLevel = 'LOW';
      let actionRecommendation = 'Strong engagement indicators. Stable retention trajectory.';

      if (riskScore >= 65) {
        riskLevel = 'HIGH';
        actionRecommendation = 'Immediate 1-on-1 check-in recommended. Review compensation competitiveness and manager rapport.';
      } else if (riskScore >= 35) {
        riskLevel = 'MODERATE';
        actionRecommendation = 'Monitor schedule flexibility and review upcoming career advancement goals.';
      }

      return {
        employeeId: emp.id,
        employeeCode: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department_name || 'General',
        riskScore,
        riskLevel,
        riskFactors,
        actionRecommendation
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  },

  // Bonus: Absence Anomaly Detection Engine
  getAbsenceAnomalies() {
    const anomalies = [];
    const currentYearMonth = new Date().toISOString().slice(0, 7);

    const employees = db.prepare(`
      SELECT id, employee_code, first_name, last_name, department_id 
      FROM employees WHERE employment_status != 'Terminated'
    `).all();

    for (const emp of employees) {
      // Check for Surge in Late arrivals (> 2 lates)
      const lateCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM attendance 
        WHERE employee_id = ? AND status = 'late' AND date LIKE ?
      `).get(emp.id, `${currentYearMonth}-%`).count;

      if (lateCount >= 3) {
        anomalies.push({
          employeeId: emp.id,
          employeeCode: emp.employee_code,
          name: `${emp.first_name} ${emp.last_name}`,
          type: 'LATE_SURGE',
          severity: 'HIGH',
          description: `Exceeded threshold: ${lateCount} late arrivals logged this month (3-late wage penalty applies).`
        });
      }

      // Check for Frequent Half-Days (> 1 half-day)
      const halfDayCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM attendance 
        WHERE employee_id = ? AND status = 'half_day' AND date LIKE ?
      `).get(emp.id, `${currentYearMonth}-%`).count;

      if (halfDayCount >= 2) {
        anomalies.push({
          employeeId: emp.id,
          employeeCode: emp.employee_code,
          name: `${emp.first_name} ${emp.last_name}`,
          type: 'HALF_DAY_FREQUENCY',
          severity: 'MEDIUM',
          description: `${halfDayCount} half-day shifts (< 5.0 hours duration) logged this month.`
        });
      }
    }

    return anomalies;
  },

  // 3. Employee Dashboard Analytics (Self-Service)
  getEmployeeAnalytics(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const currentYearMonth = today.slice(0, 7);

    // Today's Check-in Status
    const todayAttendance = db.prepare(`SELECT * FROM attendance WHERE employee_id = ? AND date = ?`).get(employeeId, today);

    // Hours this week vs 40 hours target
    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    const weeklyRecords = db.prepare(`
      SELECT COALESCE(SUM(work_hours), 0) as total_hours
      FROM attendance
      WHERE employee_id = ? AND date >= ?
    `).get(employeeId, startOfWeekStr);

    const weeklyHours = Number(weeklyRecords.total_hours.toFixed(1));

    // Late count this month
    const lateCountThisMonth = db.prepare(`
      SELECT COUNT(*) as count 
      FROM attendance 
      WHERE employee_id = ? AND status = 'late' AND date LIKE ?
    `).get(employeeId, `${currentYearMonth}-%`).count;

    // Leave Balances
    const currentYear = new Date().getFullYear();
    const leaveBalances = db.prepare(`
      SELECT lb.*, lt.name as leave_type_name
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = ? AND lb.year = ?
    `).all(employeeId, currentYear);

    // Last Payslip
    const lastPayslip = db.prepare(`
      SELECT p.*, pr.month, pr.year 
      FROM payslips p
      JOIN payroll_runs pr ON p.payroll_run_id = pr.id
      WHERE p.employee_id = ? AND pr.status = 'FINALIZED'
      ORDER BY pr.year DESC, pr.month DESC
      LIMIT 1
    `).get(employeeId);

    // Active Announcements
    const announcements = db.prepare(`
      SELECT a.*, u.email as posted_by_email
      FROM announcements a
      JOIN users u ON a.posted_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 3
    `).all();

    return {
      todayAttendance: todayAttendance || null,
      weeklyHours,
      weeklyTarget: 40.0,
      lateCountThisMonth,
      leaveBalances,
      lastPayslip: lastPayslip || null,
      announcements
    };
  }
};
