import db from '../config/db.js';
import { auditService } from './auditService.js';

export const companyService = {
  // 1. Company Settings
  getSettings() {
    const settings = db.prepare(`SELECT * FROM company_settings LIMIT 1`).get();
    if (settings && typeof settings.weekend_days === 'string') {
      try {
        settings.weekend_days = JSON.parse(settings.weekend_days);
      } catch (e) {
        settings.weekend_days = ["Saturday", "Sunday"];
      }
    }
    return settings;
  },

  updateSettings(data, actorUser) {
    const current = this.getSettings();
    if (!current) {
      throw new Error('Company settings not found. Please run initial setup.');
    }

    const {
      company_name = current.company_name,
      office_start_time = current.office_start_time,
      grace_period_minutes = current.grace_period_minutes,
      half_day_hours = current.half_day_hours,
      weekend_days = current.weekend_days,
      office_latitude = current.office_latitude,
      office_longitude = current.office_longitude,
      office_radius_meters = current.office_radius_meters,
      currency = current.currency
    } = data;

    const weekendStr = Array.isArray(weekend_days) ? JSON.stringify(weekend_days) : current.weekend_days;

    db.prepare(`
      UPDATE company_settings
      SET company_name = ?,
          office_start_time = ?,
          grace_period_minutes = ?,
          half_day_hours = ?,
          weekend_days = ?,
          office_latitude = ?,
          office_longitude = ?,
          office_radius_meters = ?,
          currency = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      company_name,
      office_start_time,
      grace_period_minutes,
      half_day_hours,
      weekendStr,
      office_latitude,
      office_longitude,
      office_radius_meters,
      currency,
      current.id
    );

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'UPDATE_COMPANY_SETTINGS',
      entity: 'SETTINGS',
      entityId: String(current.id),
      beforeJson: current,
      afterJson: data
    });

    return this.getSettings();
  },

  // 2. Departments
  getDepartments() {
    return db.prepare(`
      SELECT d.id, d.name, d.code, d.created_at,
             COUNT(DISTINCT e.id) as employee_count,
             COUNT(DISTINCT des.id) as designation_count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.employment_status != 'Terminated'
      LEFT JOIN designations des ON des.department_id = d.id
      GROUP BY d.id
      ORDER BY d.name ASC
    `).all();
  },

  createDepartment({ name, code }, actorUser) {
    if (!name || !code) {
      throw new Error('Department name and code are required.');
    }

    const existing = db.prepare(`SELECT id FROM departments WHERE LOWER(name) = ? OR LOWER(code) = ?`)
      .get(name.trim().toLowerCase(), code.trim().toLowerCase());
    
    if (existing) {
      throw new Error('A department with this name or code already exists.');
    }

    const result = db.prepare(`
      INSERT INTO departments (name, code)
      VALUES (?, ?)
    `).run(name.trim(), code.trim().toUpperCase());

    const created = db.prepare(`SELECT * FROM departments WHERE id = ?`).get(result.lastInsertRowid);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'CREATE_DEPARTMENT',
      entity: 'DEPARTMENT',
      entityId: String(created.id),
      afterJson: created
    });

    return created;
  },

  deleteDepartment(id, actorUser) {
    const employeeCount = db.prepare(`SELECT COUNT(*) as count FROM employees WHERE department_id = ?`).get(id).count;
    if (employeeCount > 0) {
      throw new Error(`Cannot delete department. There are ${employeeCount} active employees assigned to it.`);
    }

    const target = db.prepare(`SELECT * FROM departments WHERE id = ?`).get(id);
    if (!target) {
      throw new Error('Department not found.');
    }

    db.prepare(`DELETE FROM departments WHERE id = ?`).run(id);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'DELETE_DEPARTMENT',
      entity: 'DEPARTMENT',
      entityId: String(id),
      beforeJson: target
    });

    return { success: true, message: 'Department deleted successfully.' };
  },

  // 3. Designations
  getDesignations(departmentId = null) {
    let query = `
      SELECT des.id, des.title, des.department_id, des.created_at,
             d.name as department_name, d.code as department_code
      FROM designations des
      JOIN departments d ON des.department_id = d.id
    `;
    const params = [];
    if (departmentId) {
      query += ` WHERE des.department_id = ?`;
      params.push(departmentId);
    }
    query += ` ORDER BY des.title ASC`;
    return db.prepare(query).all(...params);
  },

  createDesignation({ department_id, title }, actorUser) {
    if (!department_id || !title) {
      throw new Error('Department ID and designation title are required.');
    }

    const dept = db.prepare(`SELECT id FROM departments WHERE id = ?`).get(department_id);
    if (!dept) {
      throw new Error('Specified department does not exist.');
    }

    const result = db.prepare(`
      INSERT INTO designations (department_id, title)
      VALUES (?, ?)
    `).run(department_id, title.trim());

    const created = db.prepare(`SELECT * FROM designations WHERE id = ?`).get(result.lastInsertRowid);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'CREATE_DESIGNATION',
      entity: 'DESIGNATION',
      entityId: String(created.id),
      afterJson: created
    });

    return created;
  },

  deleteDesignation(id, actorUser) {
    const target = db.prepare(`SELECT * FROM designations WHERE id = ?`).get(id);
    if (!target) {
      throw new Error('Designation not found.');
    }

    db.prepare(`DELETE FROM designations WHERE id = ?`).run(id);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'DELETE_DESIGNATION',
      entity: 'DESIGNATION',
      entityId: String(id),
      beforeJson: target
    });

    return { success: true };
  },

  // 4. Leave Types & Quotas
  getLeaveTypes() {
    return db.prepare(`SELECT * FROM leave_types ORDER BY id ASC`).all();
  },

  updateLeaveType(id, { yearly_quota }, actorUser) {
    const current = db.prepare(`SELECT * FROM leave_types WHERE id = ?`).get(id);
    if (!current) {
      throw new Error('Leave type not found.');
    }

    db.prepare(`UPDATE leave_types SET yearly_quota = ? WHERE id = ?`).run(yearly_quota, id);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'UPDATE_LEAVE_QUOTA',
      entity: 'LEAVE_TYPE',
      entityId: String(id),
      beforeJson: current,
      afterJson: { yearly_quota }
    });

    return db.prepare(`SELECT * FROM leave_types WHERE id = ?`).get(id);
  },

  // 5. Public Holidays
  getHolidays(year = null) {
    let query = `SELECT * FROM public_holidays`;
    const params = [];
    if (year) {
      query += ` WHERE holiday_date LIKE ?`;
      params.push(`${year}-%`);
    }
    query += ` ORDER BY holiday_date ASC`;
    return db.prepare(query).all(...params);
  },

  createHoliday({ name, holiday_date }, actorUser) {
    if (!name || !holiday_date) {
      throw new Error('Holiday name and ISO date (YYYY-MM-DD) are required.');
    }

    const existing = db.prepare(`SELECT id FROM public_holidays WHERE holiday_date = ?`).get(holiday_date);
    if (existing) {
      throw new Error('A holiday for this date is already registered.');
    }

    const result = db.prepare(`
      INSERT INTO public_holidays (name, holiday_date)
      VALUES (?, ?)
    `).run(name.trim(), holiday_date);

    const created = db.prepare(`SELECT * FROM public_holidays WHERE id = ?`).get(result.lastInsertRowid);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'CREATE_HOLIDAY',
      entity: 'HOLIDAY',
      entityId: String(created.id),
      afterJson: created
    });

    return created;
  },

  deleteHoliday(id, actorUser) {
    const target = db.prepare(`SELECT * FROM public_holidays WHERE id = ?`).get(id);
    if (!target) {
      throw new Error('Holiday not found.');
    }

    db.prepare(`DELETE FROM public_holidays WHERE id = ?`).run(id);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'DELETE_HOLIDAY',
      entity: 'HOLIDAY',
      entityId: String(id),
      beforeJson: target
    });

    return { success: true };
  }
};
