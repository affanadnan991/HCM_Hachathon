import db from '../config/db.js';
import { dateUtils } from '../utils/dateUtils.js';
import { auditService } from './auditService.js';
import { companyService } from './companyService.js';

export const leaveService = {
  // 1. Get Employee Leave Balances
  getLeaveBalances(employeeId, year = new Date().getFullYear()) {
    return db.prepare(`
      SELECT lb.*, lt.name as leave_type_name, lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = ? AND lb.year = ?
      ORDER BY lt.id ASC
    `).all(employeeId, year);
  },

  // 2. Apply for Leave (Enforces working days calculation, 422 overlap, 422 over-balance)
  applyLeave({ employeeId, leaveTypeId, startDate, endDate, reason }, actorUser) {
    if (!employeeId || !leaveTypeId || !startDate || !endDate || !reason) {
      throw new Error('Required fields: employeeId, leaveTypeId, startDate, endDate, reason');
    }

    const settings = companyService.getSettings();
    const workingDays = dateUtils.calculateWorkingDays(startDate, endDate, settings.weekend_days);

    if (workingDays <= 0) {
      throw new Error('Leave period contains 0 working days (dates fall entirely on weekends or registered holidays).');
    }

    // 1. Overlap Check: Existing PENDING or APPROVED leave overlapping
    const overlapping = db.prepare(`
      SELECT id, start_date, end_date, status
      FROM leave_requests
      WHERE employee_id = ? 
        AND status IN ('PENDING', 'APPROVED')
        AND start_date <= ? AND end_date >= ?
    `).get(employeeId, endDate, startDate);

    if (overlapping) {
      const err = new Error(`422 Unprocessable Entity: Leave dates overlap with an existing ${overlapping.status.toLowerCase()} request (${overlapping.start_date} to ${overlapping.end_date}).`);
      err.status = 422;
      throw err;
    }

    // 2. Over-Balance Check
    const currentYear = new Date(startDate).getFullYear();
    const leaveType = db.prepare(`SELECT * FROM leave_types WHERE id = ?`).get(leaveTypeId);
    if (!leaveType) {
      throw new Error('Specified leave type does not exist.');
    }

    // If paid leave, verify remaining quota
    if (leaveType.is_paid === 1) {
      let balance = db.prepare(`
        SELECT remaining_days, total_quota 
        FROM leave_balances 
        WHERE employee_id = ? AND leave_type_id = ? AND year = ?
      `).get(employeeId, leaveTypeId, currentYear);

      // Auto-initialize balance row if missing
      if (!balance) {
        db.prepare(`
          INSERT INTO leave_balances (employee_id, leave_type_id, year, total_quota, used_days, remaining_days)
          VALUES (?, ?, ?, ?, 0.0, ?)
        `).run(employeeId, leaveTypeId, currentYear, leaveType.yearly_quota, leaveType.yearly_quota);
        balance = { remaining_days: leaveType.yearly_quota, total_quota: leaveType.yearly_quota };
      }

      if (workingDays > balance.remaining_days) {
        const err = new Error(`422 Unprocessable Entity: Insufficient leave balance. Requested ${workingDays} working days, but you only have ${balance.remaining_days} days remaining for ${leaveType.name} leave.`);
        err.status = 422;
        throw err;
      }
    }

    // 3. Insert Request
    const result = db.prepare(`
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, working_days_count, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
    `).run(employeeId, leaveTypeId, startDate, endDate, workingDays, reason.trim());

    const created = db.prepare(`SELECT * FROM leave_requests WHERE id = ?`).get(result.lastInsertRowid);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'APPLY_LEAVE',
      entity: 'LEAVE_REQUEST',
      entityId: String(created.id),
      afterJson: { employeeId, leaveType: leaveType.name, startDate, endDate, workingDays, reason }
    });

    return created;
  },

  // 3. Cancel Leave (Employee can cancel own pending request)
  cancelLeave(leaveId, actorUser) {
    const leave = db.prepare(`SELECT * FROM leave_requests WHERE id = ?`).get(leaveId);
    if (!leave) {
      throw new Error('Leave request not found.');
    }

    if (actorUser.role === 'EMPLOYEE' && Number(leave.employee_id) !== Number(actorUser.employee_id)) {
      throw new Error('Forbidden: You can only cancel your own leave requests.');
    }

    if (leave.status !== 'PENDING') {
      throw new Error(`Cannot cancel leave request that is already ${leave.status}.`);
    }

    db.prepare(`UPDATE leave_requests SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(leaveId);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'CANCEL_LEAVE',
      entity: 'LEAVE_REQUEST',
      entityId: String(leaveId),
      beforeJson: { status: 'PENDING' },
      afterJson: { status: 'CANCELLED' }
    });

    return { success: true, message: 'Leave request cancelled successfully.' };
  },

  // 4. List Leave Requests (Scoped)
  getLeaveRequests({ status = null, employeeId = null, department_id = null }, requestingUser) {
    let query = `
      SELECT lr.*, lt.name as leave_type_name, lt.is_paid,
             e.first_name, e.last_name, e.employee_code,
             d.name as department_name,
             u.email as reviewed_by_email
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON lr.reviewed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // If Employee, restrict strictly to own requests
    if (requestingUser.role === 'EMPLOYEE') {
      query += ` AND lr.employee_id = ?`;
      params.push(requestingUser.employee_id);
    } else if (employeeId) {
      query += ` AND lr.employee_id = ?`;
      params.push(employeeId);
    }

    if (department_id) {
      query += ` AND e.department_id = ?`;
      params.push(department_id);
    }

    if (status) {
      query += ` AND lr.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY lr.created_at DESC`;
    return db.prepare(query).all(...params);
  },

  // 5. Review Leave Request (HR or Admin approves/rejects with comment)
  reviewLeaveRequest({ leaveId, status, reviewComment = '' }, actorUser) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error('Status must be APPROVED or REJECTED.');
    }

    const leave = db.prepare(`
      SELECT lr.*, lt.name as leave_type_name, lt.is_paid, e.user_id as employee_user_id
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.id = ?
    `).get(leaveId);

    if (!leave) {
      throw new Error('Leave request not found.');
    }

    if (leave.status !== 'PENDING') {
      throw new Error(`Leave request has already been ${leave.status.toLowerCase()}.`);
    }

    const transaction = db.transaction(() => {
      // 1. Update Leave Request
      db.prepare(`
        UPDATE leave_requests
        SET status = ?, reviewed_by = ?, review_comment = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, actorUser.id, reviewComment.trim(), leaveId);

      // 2. If Approved & Paid, deduct from leave balances
      if (status === 'APPROVED' && leave.is_paid === 1) {
        const year = new Date(leave.start_date).getFullYear();
        db.prepare(`
          UPDATE leave_balances
          SET used_days = used_days + ?,
              remaining_days = remaining_days - ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = ? AND leave_type_id = ? AND year = ?
        `).run(leave.working_days_count, leave.working_days_count, leave.employee_id, leave.leave_type_id, year);
      }

      // 3. Send In-App Notification to Employee
      if (leave.employee_user_id) {
        const notifMsg = status === 'APPROVED'
          ? `Your ${leave.leave_type_name} leave (${leave.start_date} to ${leave.end_date}) was approved.`
          : `Your ${leave.leave_type_name} leave was rejected. Note: ${reviewComment || 'No comment provided'}`;

        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, ?, ?, 'LEAVE')
        `).run(leave.employee_user_id, `Leave Request ${status}`, notifMsg);
      }

      // 4. Audit Log
      auditService.logAction({
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: `LEAVE_${status}`,
        entity: 'LEAVE_REQUEST',
        entityId: String(leaveId),
        beforeJson: { status: 'PENDING' },
        afterJson: { status, reviewComment, days: leave.working_days_count }
      });

      return { success: true, status, leaveId };
    });

    return transaction();
  }
};
