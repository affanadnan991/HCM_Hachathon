import db from '../config/db.js';
import { analyticsService } from './analyticsService.js';
import { attendanceService } from './attendanceService.js';
import { leaveService } from './leaveService.js';
import { employeeService } from './employeeService.js';
import { payrollService } from './payrollService.js';
import { companyService } from './companyService.js';
import { dateUtils } from '../utils/dateUtils.js';

// In-memory rate limiting: 20 requests per user per hour
const rateLimitMap = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const userRecord = rateLimitMap.get(userId) || { count: 0, resetTime: now + windowMs };

  if (now > userRecord.resetTime) {
    userRecord.count = 0;
    userRecord.resetTime = now + windowMs;
  }

  if (userRecord.count >= 20) {
    const remainingMins = Math.ceil((userRecord.resetTime - now) / 60000);
    throw new Error(`Rate limit exceeded: Max 20 AI queries per hour. Please try again in ${remainingMins} minutes.`);
  }

  userRecord.count += 1;
  rateLimitMap.set(userId, userRecord);
}

export const aiService = {
  // 1. Tool Registry (Reusable Service Calls with User Scoping)
  executeTool(toolName, args, user) {
    switch (toolName) {
      case 'get_headcount': {
        const stats = analyticsService.getAdminAnalytics({ departmentId: args.department_id });
        if (args.department_name) {
          const dept = stats.headcountByDept.find(d => d.name.toLowerCase().includes(args.department_name.toLowerCase()));
          return dept ? { department: dept.name, headcount: dept.count } : { error: `Department '${args.department_name}' not found.` };
        }
        return { total_headcount: stats.kpis.headcount, departments: stats.headcountByDept };
      }

      case 'get_attendance_summary': {
        const date = args.date || new Date().toISOString().split('T')[0];
        const hrStats = analyticsService.getHrAnalytics({ date });
        return {
          date,
          total_staff: hrStats.kpis.totalEmployees,
          present_today: hrStats.kpis.presentToday,
          late_today: hrStats.kpis.lateToday,
          half_day_today: hrStats.kpis.halfDayToday,
          on_leave_today: hrStats.kpis.onLeaveToday,
          absent_today: hrStats.kpis.absentToday,
          attendance_rate: `${hrStats.kpis.attendanceRate}%`,
          late_percentage: `${hrStats.kpis.latePercentage}%`
        };
      }

      case 'get_late_comers': {
        const hrStats = analyticsService.getHrAnalytics({});
        return {
          month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          top_late_comers: hrStats.topLateComers
        };
      }

      case 'get_my_leave_balance': {
        if (!user.employee_id) {
          return { error: 'No associated employee profile found for user.' };
        }
        const balances = leaveService.getLeaveBalances(user.employee_id);
        return {
          employee: user.name || user.email,
          leave_balances: balances.map(b => ({
            type: b.leave_type_name,
            remaining_days: b.remaining_days,
            used_days: b.used_days,
            total_quota: b.total_quota > 1000 ? 'Unlimited' : b.total_quota
          }))
        };
      }

      case 'get_leave_summary': {
        if (user.role === 'EMPLOYEE') {
          return this.executeTool('get_my_leave_balance', args, user);
        }
        const hrStats = analyticsService.getHrAnalytics({});
        return {
          pending_approvals: hrStats.kpis.pendingApprovals,
          leave_utilization: hrStats.leaveUtilization
        };
      }

      case 'get_payroll_summary': {
        // Strict Scoping: Employees CANNOT view company payroll summary!
        if (user.role === 'EMPLOYEE') {
          return {
            error: 'ACCESS_DENIED: Policy forbids employees from viewing company-wide payroll statistics.'
          };
        }
        const adminStats = analyticsService.getAdminAnalytics({});
        return {
          total_payroll_cost: `PKR ${adminStats.kpis.totalPayrollCost?.toLocaleString()}`,
          average_salary: `PKR ${adminStats.kpis.avgSalary?.toLocaleString()}`,
          payroll_by_dept: adminStats.payrollByDept
        };
      }

      case 'search_employees': {
        const query = (args.query || '').toLowerCase().trim();
        const emps = db.prepare(`
          SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email,
                 d.name as department_name, des.title as designation_title,
                 e.basic_salary, e.gross_salary
          FROM employees e
          LEFT JOIN departments d ON e.department_id = d.id
          LEFT JOIN designations des ON e.designation_id = des.id
          WHERE LOWER(e.first_name) LIKE ? OR LOWER(e.last_name) LIKE ? OR LOWER(e.email) LIKE ? OR LOWER(e.employee_code) LIKE ?
        `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);

        // Strict Scoping: If caller is EMPLOYEE, strip all salary information!
        return emps.map(emp => {
          if (user.role === 'EMPLOYEE' && Number(emp.id) !== Number(user.employee_id)) {
            return {
              employee_code: emp.employee_code,
              name: `${emp.first_name} ${emp.last_name}`,
              email: emp.email,
              department: emp.department_name,
              designation: emp.designation_title,
              salary: 'CONFIDENTIAL (Restricted by Privacy Policy)'
            };
          }
          return {
            employee_code: emp.employee_code,
            name: `${emp.first_name} ${emp.last_name}`,
            email: emp.email,
            department: emp.department_name,
            designation: emp.designation_title,
            gross_salary: `PKR ${emp.gross_salary?.toLocaleString()}`
          };
        });
      }

      default:
        return { error: `Tool '${toolName}' is not recognized.` };
    }
  },

  // 2. Smart Leave NLP Parser (Extracts { type, start_date, end_date, reason } from English or Roman Urdu)
  parseSmartLeave(text) {
    const lower = text.toLowerCase();
    const today = new Date();

    // Determine Leave Type
    let leaveType = 'Casual';
    if (lower.includes('sick') || lower.includes('doctor') || lower.includes('hospital') || lower.includes('fever') || lower.includes('tabiyat') || lower.includes('bimar')) {
      leaveType = 'Sick';
    } else if (lower.includes('annual') || lower.includes('vacation') || lower.includes('holiday') || lower.includes('safari') || lower.includes('tour')) {
      leaveType = 'Annual';
    } else if (lower.includes('unpaid') || lower.includes('bina tankhwah')) {
      leaveType = 'Unpaid';
    }

    // Determine Dates (e.g. "next monday and tuesday", "tomorrow", or standard relative days)
    let startDate = new Date(today);
    let endDate = new Date(today);

    if (lower.includes('tomorrow') || lower.includes('kal')) {
      startDate.setDate(today.getDate() + 1);
      endDate.setDate(today.getDate() + 1);
    } else if (lower.includes('next monday') || lower.includes('aglay peer') || lower.includes('monday') || lower.includes('peer')) {
      // Find next Monday
      const day = today.getDay();
      const daysUntilMon = (8 - day) % 7 || 7;
      startDate.setDate(today.getDate() + daysUntilMon);
      
      if (lower.includes('tuesday') || lower.includes('mangal') || lower.includes('two days') || lower.includes('do din')) {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1); // Tuesday
      } else if (lower.includes('wednesday') || lower.includes('budh') || lower.includes('three days') || lower.includes('teen din')) {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 2); // Wednesday
      } else {
        endDate = new Date(startDate);
      }
    } else {
      // Default to next business day
      startDate.setDate(today.getDate() + 1);
      endDate.setDate(today.getDate() + 1);
    }

    // Format ISO Dates (YYYY-MM-DD)
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    // Extract Reason
    let reason = 'Personal leave';
    if (lower.includes('wedding') || lower.includes('shadi')) {
      reason = 'Attending sister/family wedding ceremony';
    } else if (lower.includes('sick') || lower.includes('doctor') || lower.includes('fever') || lower.includes('tabiyat')) {
      reason = 'Medical leave due to health recovery';
    } else if (lower.includes('emergency')) {
      reason = 'Family emergency';
    } else if (lower.includes('exam') || lower.includes('test') || lower.includes('paper')) {
      reason = 'Academic examination';
    }

    // Calculate working days
    const workingDays = dateUtils.calculateWorkingDays(startStr, endStr);

    return {
      leave_type: leaveType,
      start_date: startStr,
      end_date: endStr,
      working_days: workingDays,
      reason
    };
  },

  // 3. Main Chat Agent (Handles Tools, Policy Q&A, Privacy Guardrails, Logging)
  async handleChat({ prompt, user }) {
    const startTime = Date.now();
    checkRateLimit(user.id);

    const query = prompt.trim();
    const lower = query.toLowerCase();

    let toolCalled = null;
    let toolArgs = null;
    let responseText = '';
    let smartLeaveData = null;

    // --- GUARDRAIL 1: Privacy Check (Colleague Salary Enquiry) ---
    // If Employee asks for colleague's salary -> Strict Polite Refusal!
    const isAskingSalary = (lower.includes('salary') || lower.includes('tankhwah') || lower.includes('compensation') || lower.includes('pay') || lower.includes('kamata')) &&
      !lower.includes('my salary') && !lower.includes('meri salary') && !lower.includes('meri tankhwah');

    if (user.role === 'EMPLOYEE' && isAskingSalary) {
      responseText = "I cannot disclose colleague compensation details. Under company privacy regulations and RBAC policies, employee salary information is strictly confidential.";
      toolCalled = 'guardrail_salary_refusal';

      this.logAiCall({
        userId: user.id,
        role: user.role,
        prompt: query,
        toolCalled,
        toolArgs: null,
        response: responseText,
        durationMs: Date.now() - startTime
      });

      return {
        reply: responseText,
        toolCalled,
        isAiGenerated: true
      };
    }

    // --- INTENT: LEAVE BALANCE INQUIRY ---
    const isBalanceQuery = lower.includes('balance') || lower.includes('remaining') || lower.includes('kitni chutti') || lower.includes('chuttiyan bachi') || lower.includes('quota') || (lower.includes('how many') && lower.includes('leave'));

    if (isBalanceQuery) {
      toolCalled = 'get_my_leave_balance';
      const result = this.executeTool('get_my_leave_balance', {}, user);
      if (result.leave_balances) {
        const balanceStrings = result.leave_balances.map(b => `${b.type}: ${b.remaining_days} days left (out of ${b.total_quota})`).join(', ');
        responseText = `Here is your current leave balance for ${new Date().getFullYear()}: ${balanceStrings}.`;
      } else {
        responseText = result.error || 'Could not fetch leave balance.';
      }

      this.logAiCall({
        userId: user.id,
        role: user.role,
        prompt: query,
        toolCalled,
        toolArgs: null,
        response: responseText,
        durationMs: Date.now() - startTime
      });

      return {
        reply: responseText,
        toolCalled,
        isAiGenerated: true
      };
    }

    // --- SMART LEAVE DETECTION ---
    const isApplyingLeave = (lower.includes('off') || lower.includes('leave') || lower.includes('chutti')) &&
      (lower.includes('need') || lower.includes('want') || lower.includes('apply') || lower.includes('chahiye') || lower.includes('par hoon') || lower.includes('wedding') || lower.includes('kal') || lower.includes('tomorrow') || lower.includes('next'));

    if (isApplyingLeave) {
      smartLeaveData = this.parseSmartLeave(query);
      toolCalled = 'parse_smart_leave';
      toolArgs = JSON.stringify(smartLeaveData);
      responseText = `I have prepared your ${smartLeaveData.leave_type} leave request from ${smartLeaveData.start_date} to ${smartLeaveData.end_date} (${smartLeaveData.working_days} working days) for: "${smartLeaveData.reason}". Please review and confirm below.`;

      this.logAiCall({
        userId: user.id,
        role: user.role,
        prompt: query,
        toolCalled,
        toolArgs,
        response: responseText,
        durationMs: Date.now() - startTime
      });

      return {
        reply: responseText,
        toolCalled,
        smartLeave: smartLeaveData,
        isAiGenerated: true
      };
    } if (lower.includes('headcount') || lower.includes('how many active employees') || lower.includes('kitnay employees')) {
      toolCalled = 'get_headcount';
      let deptName = null;
      if (lower.includes('engineering')) deptName = 'Engineering';
      if (lower.includes('human resources') || lower.includes('hr')) deptName = 'Human Resources';
      if (lower.includes('sales')) deptName = 'Sales';

      const result = this.executeTool('get_headcount', { department_name: deptName }, user);
      if (result.department) {
        responseText = `There are currently ${result.headcount} active employees in the ${result.department} department.`;
      } else {
        responseText = `Total active company headcount is ${result.total_headcount} employees across ${result.departments?.length || 0} departments.`;
      }
    } else if (lower.includes('attendance rate') || lower.includes('attendance') || lower.includes('hazri') || lower.includes('who is on leave')) {
      toolCalled = 'get_attendance_summary';
      const result = this.executeTool('get_attendance_summary', {}, user);
      if (lower.includes('who is on leave') || lower.includes('on leave today') || lower.includes('chutti par')) {
        responseText = `Today there are ${result.on_leave_today} employees on approved leave (${result.present_today} present, ${result.late_today} late, and ${result.absent_today} absent).`;
      } else {
        responseText = `This month's current attendance rate is ${result.attendance_rate}. Today: ${result.present_today} present, ${result.late_today} late arrivals (${result.late_percentage} of check-ins).`;
      }
    } else if (lower.includes('late most often') || lower.includes('late comers') || lower.includes('top late') || lower.includes('kon late aya')) {
      toolCalled = 'get_late_comers';
      const result = this.executeTool('get_late_comers', {}, user);
      if (result.top_late_comers?.length > 0) {
        const leaders = result.top_late_comers.map(e => `${e.first_name} ${e.last_name} (${e.late_count} times)`).join(', ');
        responseText = `Top late arrivals for ${result.month}: ${leaders}. Office timing starts at 09:00 AM with a 15-minute grace period (late after 09:15 AM).`;
      } else {
        responseText = `No frequent late arrivals recorded for ${result.month}! Everyone has maintained excellent punctuality.`;
      }
    } else if (lower.includes('payroll') || lower.includes('salary cost') || lower.includes('tankhwah')) {
      toolCalled = 'get_payroll_summary';
      const result = this.executeTool('get_payroll_summary', {}, user);
      if (result.error) {
        responseText = result.error;
      } else {
        responseText = `Latest finalized payroll cost is ${result.total_payroll_cost} with a company average salary of ${result.average_salary}.`;
      }
    } else if (lower.includes('policy') || lower.includes('grace period') || lower.includes('half day') || lower.includes('timing') || lower.includes('tax slab')) {
      // Policy Q&A
      if (lower.includes('grace') || lower.includes('timing')) {
        responseText = "Company Policy: Standard office start time is 09:00 AM with a 15-minute grace period. Check-in after 09:15 AM is marked as 'late'.";
      } else if (lower.includes('half day')) {
        responseText = "Company Policy: Work shifts under 5.0 hours of total duration are categorized as a 'half day'.";
      } else if (lower.includes('tax')) {
        responseText = "Income Tax Policy: Pakistan tax brackets are applied on Annual Gross (12x): 0-600k (0%), 600k-1.2M (5%), 1.2M-2.4M (30k + 15%), 2.4M-3.6M (210k + 25%), >3.6M (510k + 35%).";
      } else {
        responseText = "Company Policy: Work week is Monday to Friday (Saturday-Sunday weekends). Annual leave quota: 14 Annual, 8 Sick, 10 Casual days.";
      }
    } else {
      // General Employee Search / Fallback
      toolCalled = 'search_employees';
      const emps = this.executeTool('search_employees', { query }, user);
      if (emps.length > 0) {
        const emp = emps[0];
        responseText = `Found employee ${emp.name} (${emp.employee_code}) in ${emp.department} as ${emp.designation}. Contact: ${emp.email}.`;
      } else {
        responseText = `I understand your question regarding "${query}". As an AI assistant for HCM Lite, I can answer queries on attendance, leave balances, headcount, office policies, or book smart leaves for you.`;
      }
    }

    this.logAiCall({
      userId: user.id,
      role: user.role,
      prompt: query,
      toolCalled,
      toolArgs,
      response: responseText,
      durationMs: Date.now() - startTime
    });

    return {
      reply: responseText,
      toolCalled,
      smartLeave: smartLeaveData,
      isAiGenerated: true
    };
  },

  // 4. Dashboard Summarizer (Generates 3-5 bullet insights from current KPI JSON)
  summarizeDashboard(kpiJson, role = 'HR') {
    const bullets = [];

    if (role === 'ADMIN') {
      bullets.push(`Workforce scale stands at ${kpiJson.headcount || 0} active employees with an annualized attrition rate of ${kpiJson.attritionRate || 0}%.`);
      bullets.push(`Latest total monthly payroll liability is PKR ${Number(kpiJson.totalPayrollCost || 0).toLocaleString()} with a mean salary of PKR ${Number(kpiJson.avgSalary || 0).toLocaleString()}.`);
      bullets.push(`Workforce distribution spans multiple functional departments with robust audit logging active across all operations.`);
    } else {
      bullets.push(`Today's operational attendance rate is ${kpiJson.attendanceRate || 0}% with ${kpiJson.presentToday || 0} employees actively present on duty.`);
      bullets.push(`${kpiJson.lateToday || 0} employees arrived after the 09:15 AM grace threshold, representing ${kpiJson.latePercentage || 0}% of morning check-ins.`);
      bullets.push(`There are currently ${kpiJson.pendingApprovals || 0} action items awaiting manager approval in leave and attendance inboxes.`);
    }

    return {
      summary_bullets: bullets,
      generated_at: new Date().toISOString(),
      isAiGenerated: true
    };
  },

  // 5. Audit Logging for AI Calls
  logAiCall({ userId, role, prompt, toolCalled, toolArgs, response, durationMs }) {
    try {
      db.prepare(`
        INSERT INTO ai_logs (user_id, role, prompt, tool_called, tool_args, response, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, role, prompt, toolCalled, toolArgs, response, durationMs);
    } catch (e) {
      console.error('Failed to log AI call:', e.message);
    }
  }
};
