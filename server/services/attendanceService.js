import db from '../config/db.js';
import { dateUtils } from '../utils/dateUtils.js';
import { auditService } from './auditService.js';
import { companyService } from './companyService.js';

export const attendanceService = {
  // 1. Employee Check-In (Server stamps timestamp; 2nd checkin = 409)
  checkIn({ employeeId, source = 'web', lat = null, lng = null }, actorUser) {
    const today = new Date().toISOString().split('T')[0];

    // Check duplicate check-in
    const existing = db.prepare(`SELECT id, check_in_time FROM attendance WHERE employee_id = ? AND date = ?`)
      .get(employeeId, today);

    if (existing) {
      const err = new Error('409 Conflict: Check-in already recorded for today.');
      err.status = 409;
      throw err;
    }

    const settings = companyService.getSettings();
    const serverTime = new Date();
    const checkInIso = serverTime.toISOString();

    // Check Geofence if coordinates are provided and office location is configured
    let distance = null;
    if (lat && lng && settings.office_latitude && settings.office_longitude) {
      distance = dateUtils.calculateHaversineDistance(
        settings.office_latitude,
        settings.office_longitude,
        Number(lat),
        Number(lng)
      );

      // If source is camera/mobile and strict geofencing applies:
      if (source === 'camera' && distance > settings.office_radius_meters) {
        throw new Error(`Location outside office perimeter (${distance}m away). Max radius allowed is ${settings.office_radius_meters}m.`);
      }
    }

    // Calculate Late Status: Office Start (09:00) + Grace (15m) => 09:15 Threshold
    const [startH, startM] = (settings.office_start_time || '09:00').split(':').map(Number);
    const grace = settings.grace_period_minutes || 15;

    const thresholdMinutes = startH * 60 + startM + grace; // 9*60 + 0 + 15 = 555 mins
    const checkInMinutes = serverTime.getHours() * 60 + serverTime.getMinutes();

    const isLate = checkInMinutes > thresholdMinutes;
    const initialStatus = isLate ? 'late' : 'present';

    const result = db.prepare(`
      INSERT INTO attendance (
        employee_id, date, check_in_time, status, source,
        check_in_lat, check_in_lng, distance_meters
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeId, today, checkInIso, initialStatus, source,
      lat ? Number(lat) : null, lng ? Number(lng) : null, distance
    );

    const record = db.prepare(`SELECT * FROM attendance WHERE id = ?`).get(result.lastInsertRowid);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'CHECK_IN',
      entity: 'ATTENDANCE',
      entityId: String(record.id),
      afterJson: { date: today, time: checkInIso, status: initialStatus, source, distance }
    });

    return record;
  },

  // 2. Employee Check-Out (Calculates work hours and half-day status)
  checkOut({ employeeId, lat = null, lng = null }, actorUser) {
    const today = new Date().toISOString().split('T')[0];

    const record = db.prepare(`SELECT * FROM attendance WHERE employee_id = ? AND date = ?`)
      .get(employeeId, today);

    if (!record) {
      throw new Error('No check-in record found for today. You must check in first.');
    }

    if (record.check_out_time) {
      throw new Error('Check-out already completed for today.');
    }

    const settings = companyService.getSettings();
    const checkOutIso = new Date().toISOString();

    const workHours = dateUtils.calculateHoursDifference(record.check_in_time, checkOutIso);

    // If work hours < half_day threshold (5.0 hours) => half_day
    let finalStatus = record.status;
    if (workHours < (settings.half_day_hours || 5.0)) {
      finalStatus = 'half_day';
    }

    db.prepare(`
      UPDATE attendance
      SET check_out_time = ?, work_hours = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(checkOutIso, workHours, finalStatus, record.id);

    const updated = db.prepare(`SELECT * FROM attendance WHERE id = ?`).get(record.id);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'CHECK_OUT',
      entity: 'ATTENDANCE',
      entityId: String(record.id),
      beforeJson: { check_in: record.check_in_time, status: record.status },
      afterJson: { check_out: checkOutIso, work_hours: workHours, status: finalStatus }
    });

    return updated;
  },

  // 3. Get Today's Status for an Employee
  getTodayStatus(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const record = db.prepare(`SELECT * FROM attendance WHERE employee_id = ? AND date = ?`).get(employeeId, today);
    return record || null;
  },

  // 4. Daily Attendance Board (Admin & HR view of all employees with computed absent/missing_checkout)
  getDailyBoard({ date = new Date().toISOString().split('T')[0], department_id = null }) {
    const settings = companyService.getSettings();
    let empQuery = `SELECT id, employee_code, first_name, last_name, email, department_id FROM employees WHERE employment_status != 'Terminated'`;
    const empParams = [];

    if (department_id) {
      empQuery += ` AND department_id = ?`;
      empParams.push(department_id);
    }

    const allEmployees = db.prepare(empQuery).all(...empParams);

    // Fetch attendance records for this date
    const attendanceRecords = db.prepare(`
      SELECT a.*, e.first_name, e.last_name, e.employee_code, d.name as department_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE a.date = ?
    `).all(date);

    const attendanceMap = new Map(attendanceRecords.map(a => [a.employee_id, a]));

    // Fetch approved leaves covering this date
    const approvedLeaves = db.prepare(`
      SELECT lr.*, lt.name as leave_type_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.status = 'APPROVED' AND ? BETWEEN lr.start_date AND lr.end_date
    `).all(date);

    const leaveMap = new Map(approvedLeaves.map(l => [l.employee_id, l]));

    // Compute complete roster
    const board = allEmployees.map(emp => {
      const att = attendanceMap.get(emp.id);
      const onLeave = leaveMap.get(emp.id);

      if (att) {
        return {
          ...att,
          isOnLeave: false,
          leaveDetails: null
        };
      }

      if (onLeave) {
        return {
          id: null,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          first_name: emp.first_name,
          last_name: emp.last_name,
          date,
          check_in_time: null,
          check_out_time: null,
          work_hours: 0,
          status: 'on_leave',
          isOnLeave: true,
          leaveDetails: onLeave.leave_type_name
        };
      }

      // If weekend or holiday, mark as weekend/holiday
      const isWknd = dateUtils.isWeekend(date, settings.weekend_days);
      const isHol = db.prepare(`SELECT name FROM public_holidays WHERE holiday_date = ?`).get(date);

      if (isHol) {
        return {
          id: null,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          first_name: emp.first_name,
          last_name: emp.last_name,
          date,
          status: 'holiday',
          holidayName: isHol.name
        };
      }

      if (isWknd) {
        return {
          id: null,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          first_name: emp.first_name,
          last_name: emp.last_name,
          date,
          status: 'weekend'
        };
      }

      // No record, not on leave, not holiday/weekend => Absent
      return {
        id: null,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        first_name: emp.first_name,
        last_name: emp.last_name,
        date,
        check_in_time: null,
        check_out_time: null,
        work_hours: 0,
        status: 'absent'
      };
    });

    return {
      date,
      summary: {
        total: allEmployees.length,
        present: board.filter(b => b.status === 'present').length,
        late: board.filter(b => b.status === 'late').length,
        half_day: board.filter(b => b.status === 'half_day').length,
        on_leave: board.filter(b => b.status === 'on_leave').length,
        absent: board.filter(b => b.status === 'absent').length
      },
      board
    };
  },

  // 5. Attendance History for Employee (Calendar view)
  getEmployeeHistory(employeeId, { month, year }, requestingUser) {
    if (requestingUser.role === 'EMPLOYEE' && Number(employeeId) !== Number(requestingUser.employee_id)) {
      throw new Error('Forbidden: Employees can only view their own attendance.');
    }

    let query = `
      SELECT a.*, ac.status as correction_status
      FROM attendance a
      LEFT JOIN attendance_corrections ac ON ac.attendance_id = a.id
      WHERE a.employee_id = ?
    `;
    const params = [employeeId];

    if (month && year) {
      const monthStr = String(month).padStart(2, '0');
      query += ` AND a.date LIKE ?`;
      params.push(`${year}-${monthStr}-%`);
    }

    query += ` ORDER BY a.date DESC`;
    return db.prepare(query).all(...params);
  },

  // 6. Request Attendance Correction (Employee)
  requestCorrection({ attendanceId = null, employeeId, requestedCheckIn, requestedCheckOut, reason }, actorUser) {
    if (!requestedCheckIn || !requestedCheckOut || !reason) {
      throw new Error('Requested check-in, check-out, and reason are required.');
    }

    const result = db.prepare(`
      INSERT INTO attendance_corrections (
        attendance_id, employee_id, requested_check_in, requested_check_out, reason, status
      ) VALUES (?, ?, ?, ?, ?, 'PENDING')
    `).run(attendanceId, employeeId, requestedCheckIn, requestedCheckOut, reason.trim());

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'REQUEST_ATTENDANCE_CORRECTION',
      entity: 'ATTENDANCE_CORRECTION',
      entityId: String(result.lastInsertRowid),
      afterJson: { employeeId, requestedCheckIn, requestedCheckOut, reason }
    });

    return { success: true, id: result.lastInsertRowid };
  },

  // 7. List Correction Requests (HR & Admin)
  getCorrectionRequests(status = 'PENDING') {
    let query = `
      SELECT ac.*, e.first_name, e.last_name, e.employee_code, d.name as department_name,
             a.date, a.check_in_time as original_check_in, a.check_out_time as original_check_out, a.status as original_status
      FROM attendance_corrections ac
      JOIN employees e ON ac.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN attendance a ON ac.attendance_id = a.id
    `;
    const params = [];
    if (status) {
      query += ` WHERE ac.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY ac.created_at DESC`;
    return db.prepare(query).all(...params);
  },

  // 8. Review Correction (HR approves/rejects)
  reviewCorrection({ correctionId, status, reviewComment = '' }, actorUser) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error('Status must be APPROVED or REJECTED.');
    }

    const correction = db.prepare(`SELECT * FROM attendance_corrections WHERE id = ?`).get(correctionId);
    if (!correction) {
      throw new Error('Correction request not found.');
    }

    if (correction.status !== 'PENDING') {
      throw new Error('Correction request has already been reviewed.');
    }

    const transaction = db.transaction(() => {
      // Update correction status
      db.prepare(`
        UPDATE attendance_corrections
        SET status = ?, reviewed_by = ?, review_comment = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, actorUser.id, reviewComment.trim(), correctionId);

      // If approved, update or create attendance record
      if (status === 'APPROVED') {
        const settings = companyService.getSettings();
        const date = correction.requested_check_in.split('T')[0];
        const workHours = dateUtils.calculateHoursDifference(correction.requested_check_in, correction.requested_check_out);

        // Calculate status
        const [startH, startM] = (settings.office_start_time || '09:00').split(':').map(Number);
        const threshold = startH * 60 + startM + (settings.grace_period_minutes || 15);
        // Calculate status from time string directly
        const timePart = correction.requested_check_in.includes('T')
          ? correction.requested_check_in.split('T')[1].slice(0, 5)
          : '09:00';
        const [reqH, reqM] = timePart.split(':').map(Number);
        const checkInMins = (reqH || 0) * 60 + (reqM || 0);

        let newStatus = checkInMins > threshold ? 'late' : 'present';
        if (workHours < (settings.half_day_hours || 5.0)) {
          newStatus = 'half_day';
        }

        if (correction.attendance_id) {
          db.prepare(`
            UPDATE attendance
            SET check_in_time = ?, check_out_time = ?, work_hours = ?, status = ?, is_corrected = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(correction.requested_check_in, correction.requested_check_out, workHours, newStatus, correction.attendance_id);
        } else {
          db.prepare(`
            INSERT INTO attendance (employee_id, date, check_in_time, check_out_time, work_hours, status, is_corrected)
            VALUES (?, ?, ?, ?, ?, ?, 1)
          `).run(correction.employee_id, date, correction.requested_check_in, correction.requested_check_out, workHours, newStatus);
        }
      }

      auditService.logAction({
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: `CORRECTION_${status}`,
        entity: 'ATTENDANCE_CORRECTION',
        entityId: String(correctionId),
        afterJson: { status, reviewComment }
      });

      return { success: true, status };
    });

    return transaction();
  }
};
