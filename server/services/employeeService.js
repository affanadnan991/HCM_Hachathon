import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { auditService } from './auditService.js';

export const employeeService = {
  // Generate next unique employee code (e.g. EMP-001)
  getNextEmployeeCode() {
    const last = db.prepare(`SELECT employee_code FROM employees ORDER BY id DESC LIMIT 1`).get();
    if (!last || !last.employee_code.startsWith('EMP-')) {
      return 'EMP-001';
    }
    const num = parseInt(last.employee_code.replace('EMP-', ''), 10);
    const nextNum = isNaN(num) ? 1 : num + 1;
    return `EMP-${String(nextNum).padStart(3, '0')}`;
  },

  // Register Employee (Creates employee + user login + leave balances + salary breakdown)
  registerEmployee(data, actorUser) {
    const {
      first_name,
      last_name,
      email,
      phone = '',
      address = '',
      gender = 'Male',
      department_id,
      designation_id = null,
      date_of_joining,
      employment_status = 'Active',
      basic_salary,
      temporary_password = 'Password@123'
    } = data;

    if (!first_name || !last_name || !email || !department_id || !date_of_joining || !basic_salary) {
      throw new Error('Required fields: first_name, last_name, email, department_id, date_of_joining, basic_salary');
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check unique email in users and employees
    const emailExists = db.prepare(`SELECT id FROM users WHERE LOWER(email) = ?`).get(cleanEmail);
    if (emailExists) {
      throw new Error(`User with email "${cleanEmail}" is already registered.`);
    }

    const basic = Number(basic_salary);
    if (isNaN(basic) || basic <= 0) {
      throw new Error('Basic salary must be a positive number.');
    }

    // Salary Structure Formulas
    const hra = Number((basic * 0.40).toFixed(2));
    const medical = Number((basic * 0.10).toFixed(2));
    const gross = Number((basic * 1.50).toFixed(2));

    const employeeCode = data.employee_code?.trim() || this.getNextEmployeeCode();

    const transaction = db.transaction(() => {
      // 1. Create User Login with must_change_password = 1
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(temporary_password, salt);

      const userResult = db.prepare(`
        INSERT INTO users (email, password_hash, role, is_active, must_change_password)
        VALUES (?, ?, 'EMPLOYEE', 1, 1)
      `).run(cleanEmail, passwordHash);

      const userId = userResult.lastInsertRowid;

      // 2. Create Employee Record
      const empResult = db.prepare(`
        INSERT INTO employees (
          user_id, employee_code, first_name, last_name, email, phone, address,
          gender, department_id, designation_id, date_of_joining, employment_status,
          basic_salary, hra_allowance, medical_allowance, gross_salary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, employeeCode, first_name.trim(), last_name.trim(), cleanEmail, phone.trim(),
        address.trim(), gender, department_id, designation_id, date_of_joining,
        employment_status, basic, hra, medical, gross
      );

      const employeeId = empResult.lastInsertRowid;

      // 3. Initialize Leave Balances for Current Year
      const currentYear = new Date().getFullYear();
      const leaveTypes = db.prepare(`SELECT id, yearly_quota FROM leave_types`).all();

      for (const lt of leaveTypes) {
        db.prepare(`
          INSERT INTO leave_balances (employee_id, leave_type_id, year, total_quota, used_days, remaining_days)
          VALUES (?, ?, ?, ?, 0.0, ?)
        `).run(employeeId, lt.id, currentYear, lt.yearly_quota, lt.yearly_quota);
      }

      // 4. Log to Audit Trail
      auditService.logAction({
        actorId: actorUser.id,
        actorRole: actorUser.role,
        action: 'REGISTER_EMPLOYEE',
        entity: 'EMPLOYEE',
        entityId: String(employeeId),
        afterJson: {
          employeeId,
          employeeCode,
          name: `${first_name} ${last_name}`,
          email: cleanEmail,
          grossSalary: gross,
          department_id
        }
      });

      return this.getEmployeeById(employeeId, actorUser);
    });

    return transaction();
  },

  // Employee Directory with Server-Side Search, Filters, and Pagination
  getEmployees({ search = '', department_id = '', status = '', page = 1, limit = 20 }) {
    const offset = (Number(page) - 1) * Number(limit);
    let whereClauses = ['1=1'];
    const params = [];

    if (search) {
      whereClauses.push(`(
        LOWER(e.first_name) LIKE ? OR 
        LOWER(e.last_name) LIKE ? OR 
        LOWER(e.email) LIKE ? OR 
        LOWER(e.employee_code) LIKE ?
      )`);
      const searchParam = `%${search.toLowerCase().trim()}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (department_id) {
      whereClauses.push(`e.department_id = ?`);
      params.push(Number(department_id));
    }

    if (status) {
      whereClauses.push(`e.employment_status = ?`);
      params.push(status);
    }

    const whereStr = whereClauses.join(' AND ');

    // Total count query
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM employees e 
      WHERE ${whereStr}
    `).get(...params).count;

    // Data query with joins
    const employees = db.prepare(`
      SELECT 
        e.*,
        d.name as department_name,
        d.code as department_code,
        des.title as designation_title,
        u.is_active as is_user_active,
        u.must_change_password
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE ${whereStr}
      ORDER BY e.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    return {
      employees,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / Number(limit)) || 1
      }
    };
  },

  // Employee 360 Profile
  getEmployeeById(id, requestingUser) {
    // If Employee role, restrict strictly to own profile
    if (requestingUser.role === 'EMPLOYEE' && Number(id) !== Number(requestingUser.employee_id)) {
      throw new Error('Forbidden: You can only view your own profile.');
    }

    const employee = db.prepare(`
      SELECT 
        e.*,
        d.name as department_name,
        d.code as department_code,
        des.title as designation_title,
        u.is_active as is_user_active
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ?
    `).get(id);

    if (!employee) {
      throw new Error('Employee not found.');
    }

    // Leave Balances for 360 profile
    const currentYear = new Date().getFullYear();
    const leaveBalances = db.prepare(`
      SELECT lb.*, lt.name as leave_type_name, lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = ? AND lb.year = ?
    `).all(id, currentYear);

    // Recent Attendance (Last 10 days)
    const recentAttendance = db.prepare(`
      SELECT * FROM attendance
      WHERE employee_id = ?
      ORDER BY date DESC
      LIMIT 10
    `).all(id);

    // Recent Payslips
    const recentPayslips = db.prepare(`
      SELECT p.*, pr.month, pr.year, pr.status as run_status
      FROM payslips p
      JOIN payroll_runs pr ON p.payroll_run_id = pr.id
      WHERE p.employee_id = ?
      ORDER BY pr.year DESC, pr.month DESC
      LIMIT 6
    `).all(id);

    return {
      ...employee,
      leaveBalances,
      recentAttendance,
      recentPayslips
    };
  },

  // Update Employee (Scope guarded: Employee can only update phone and address)
  updateEmployee(id, updateData, requestingUser) {
    const current = this.getEmployeeById(id, requestingUser);

    // If Employee role: enforce that ONLY phone and address can be updated
    if (requestingUser.role === 'EMPLOYEE') {
      const allowedKeys = ['phone', 'address'];
      const attemptedKeys = Object.keys(updateData);
      const unauthorizedKeys = attemptedKeys.filter(k => !allowedKeys.includes(k));

      if (unauthorizedKeys.length > 0) {
        throw new Error(`Forbidden: Employees cannot update fields [${unauthorizedKeys.join(', ')}]. You can only edit phone and address.`);
      }

      db.prepare(`
        UPDATE employees
        SET phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        updateData.phone !== undefined ? updateData.phone : current.phone,
        updateData.address !== undefined ? updateData.address : current.address,
        id
      );

      auditService.logAction({
        actorId: requestingUser.id,
        actorRole: requestingUser.role,
        action: 'UPDATE_OWN_PROFILE',
        entity: 'EMPLOYEE',
        entityId: String(id),
        beforeJson: { phone: current.phone, address: current.address },
        afterJson: { phone: updateData.phone, address: updateData.address }
      });

      return this.getEmployeeById(id, requestingUser);
    }

    // If HR or Admin: can update job and salary details
    const {
      first_name = current.first_name,
      last_name = current.last_name,
      phone = current.phone,
      address = current.address,
      gender = current.gender,
      department_id = current.department_id,
      designation_id = current.designation_id,
      date_of_joining = current.date_of_joining,
      employment_status = current.employment_status,
      basic_salary = current.basic_salary
    } = updateData;

    const basic = Number(basic_salary);
    const hra = Number((basic * 0.40).toFixed(2));
    const medical = Number((basic * 0.10).toFixed(2));
    const gross = Number((basic * 1.50).toFixed(2));

    db.prepare(`
      UPDATE employees
      SET first_name = ?, last_name = ?, phone = ?, address = ?, gender = ?,
          department_id = ?, designation_id = ?, date_of_joining = ?,
          employment_status = ?, basic_salary = ?, hra_allowance = ?,
          medical_allowance = ?, gross_salary = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      first_name, last_name, phone, address, gender,
      department_id, designation_id, date_of_joining,
      employment_status, basic, hra, medical, gross, id
    );

    auditService.logAction({
      actorId: requestingUser.id,
      actorRole: requestingUser.role,
      action: 'UPDATE_EMPLOYEE',
      entity: 'EMPLOYEE',
      entityId: String(id),
      beforeJson: current,
      afterJson: updateData
    });

    return this.getEmployeeById(id, requestingUser);
  },

  // CSV Dry-Run Validation (Checks row + field + reason without committing)
  dryRunCsvImport(rows) {
    const departments = db.prepare(`SELECT id, LOWER(name) as name_lower, LOWER(code) as code_lower FROM departments`).all();
    const existingEmails = new Set(db.prepare(`SELECT LOWER(email) as email FROM users`).all().map(u => u.email));
    const existingCodes = new Set(db.prepare(`SELECT LOWER(employee_code) as code FROM employees`).all().map(e => e.code));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    const errors = [];
    const validRows = [];
    const seenEmailsInCsv = new Set();
    const seenCodesInCsv = new Set();

    rows.forEach((row, index) => {
      const rowNum = index + 1;
      const rowErrors = [];

      // 1. Required Fields Check
      const requiredFields = ['first_name', 'last_name', 'email', 'department', 'date_of_joining', 'basic_salary'];
      for (const field of requiredFields) {
        if (!row[field] || String(row[field]).trim() === '') {
          rowErrors.push({ row: rowNum, field, reason: `Field '${field}' is required.` });
        }
      }

      // 2. Email Validation & Uniqueness
      if (row.email) {
        const cleanEmail = String(row.email).toLowerCase().trim();
        if (!emailRegex.test(cleanEmail)) {
          rowErrors.push({ row: rowNum, field: 'email', reason: 'Invalid email address format.' });
        } else if (existingEmails.has(cleanEmail)) {
          rowErrors.push({ row: rowNum, field: 'email', reason: 'Email already exists in the system.' });
        } else if (seenEmailsInCsv.has(cleanEmail)) {
          rowErrors.push({ row: rowNum, field: 'email', reason: 'Duplicate email within this CSV file.' });
        } else {
          seenEmailsInCsv.add(cleanEmail);
        }
      }

      // 3. Employee Code (if specified)
      if (row.employee_code) {
        const cleanCode = String(row.employee_code).toLowerCase().trim();
        if (existingCodes.has(cleanCode)) {
          rowErrors.push({ row: rowNum, field: 'employee_code', reason: 'Employee code already exists.' });
        } else if (seenCodesInCsv.has(cleanCode)) {
          rowErrors.push({ row: rowNum, field: 'employee_code', reason: 'Duplicate employee code within CSV.' });
        } else {
          seenCodesInCsv.add(cleanCode);
        }
      }

      // 4. Known Department Check
      let matchedDeptId = null;
      if (row.department) {
        const deptInput = String(row.department).toLowerCase().trim();
        const matched = departments.find(d => d.name_lower === deptInput || d.code_lower === deptInput);
        if (!matched) {
          rowErrors.push({ 
            row: rowNum, 
            field: 'department', 
            reason: `Unknown department '${row.department}'. Must match an existing department.` 
          });
        } else {
          matchedDeptId = matched.id;
        }
      }

      // 5. ISO Date Check (YYYY-MM-DD)
      if (row.date_of_joining && !isoDateRegex.test(String(row.date_of_joining).trim())) {
        rowErrors.push({ 
          row: rowNum, 
          field: 'date_of_joining', 
          reason: 'Date of joining must be in valid ISO format (YYYY-MM-DD).' 
        });
      }

      // 6. Positive Salary Check
      const salary = Number(row.basic_salary);
      if (isNaN(salary) || salary <= 0) {
        rowErrors.push({ 
          row: rowNum, 
          field: 'basic_salary', 
          reason: 'Basic salary must be a numeric value greater than 0.' 
        });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validRows.push({
          ...row,
          department_id: matchedDeptId,
          basic_salary: salary
        });
      }
    });

    return {
      total_rows: rows.length,
      valid_rows_count: validRows.length,
      invalid_rows_count: rows.length - validRows.length,
      errors,
      valid_rows: validRows
    };
  },

  // Commit CSV Import (Saves valid rows into DB)
  commitCsvImport(validRows, actorUser) {
    const results = [];
    const transaction = db.transaction(() => {
      for (const row of validRows) {
        const registered = this.registerEmployee({
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone || '',
          address: row.address || '',
          gender: row.gender || 'Male',
          department_id: row.department_id,
          employee_code: row.employee_code || null,
          date_of_joining: row.date_of_joining,
          basic_salary: row.basic_salary,
          temporary_password: 'Welcome@123'
        }, actorUser);
        results.push(registered);
      }
      return results;
    });

    return transaction();
  },

  // Export all employees to CSV string
  exportEmployeesCsv() {
    const employees = db.prepare(`
      SELECT 
        e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.address,
        e.gender, d.name as department, des.title as designation,
        e.date_of_joining, e.employment_status,
        e.basic_salary, e.hra_allowance, e.medical_allowance, e.gross_salary
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      ORDER BY e.id ASC
    `).all();

    if (employees.length === 0) {
      return 'employee_code,first_name,last_name,email,phone,address,gender,department,designation,date_of_joining,employment_status,basic_salary,hra_allowance,medical_allowance,gross_salary\n';
    }

    const headers = Object.keys(employees[0]).join(',');
    const csvRows = employees.map(emp => {
      return Object.values(emp).map(val => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') ? `"${str}"` : str;
      }).join(',');
    });

    return [headers, ...csvRows].join('\n');
  }
};
