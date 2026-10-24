import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { auditService } from './auditService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'saylani_hcm_lite_super_secure_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export const authService = {
  // Check if system has an Admin or needs first-run bootstrap
  checkFirstRunStatus() {
    const adminCount = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'`).get().count;
    const settings = db.prepare(`SELECT * FROM company_settings LIMIT 1`).get();
    
    return {
      isFirstRun: adminCount === 0,
      isConfigured: settings ? Boolean(settings.is_configured) : false,
      company: settings || null
    };
  },

  // First-run setup: creates company profile and initial Admin account
  bootstrapAdmin({ companyName, adminEmail, adminPassword, officeStartTime = '09:00', gracePeriod = 15, halfDayHours = 5.0, weekendDays = ["Saturday","Sunday"], officeLat = null, officeLng = null, officeRadius = 150 }) {
    const adminExists = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'`).get().count;
    if (adminExists > 0) {
      throw new Error('Initial setup already completed. Admin account exists.');
    }

    if (!adminEmail || !adminPassword || !companyName) {
      throw new Error('Company name, admin email, and admin password are required.');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(adminPassword, salt);

    const transaction = db.transaction(() => {
      // 1. Create Admin User
      const userResult = db.prepare(`
        INSERT INTO users (email, password_hash, role, is_active, must_change_password)
        VALUES (?, ?, 'ADMIN', 1, 0)
      `).run(adminEmail.toLowerCase().trim(), passwordHash);

      const adminUserId = userResult.lastInsertRowid;

      // 2. Insert or replace Company Settings
      db.prepare(`DELETE FROM company_settings`).run();
      db.prepare(`
        INSERT INTO company_settings (
          company_name, office_start_time, grace_period_minutes, half_day_hours, 
          weekend_days, office_latitude, office_longitude, office_radius_meters, is_configured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        companyName.trim(), 
        officeStartTime, 
        gracePeriod, 
        halfDayHours, 
        JSON.stringify(weekendDays), 
        officeLat, 
        officeLng, 
        officeRadius
      );

      // 3. Initialize default Leave Types if not present
      const defaultLeaves = [
        { name: 'Annual', quota: 14, is_paid: 1 },
        { name: 'Sick', quota: 8, is_paid: 1 },
        { name: 'Casual', quota: 10, is_paid: 1 },
        { name: 'Unpaid', quota: 9999, is_paid: 0 }
      ];

      for (const leave of defaultLeaves) {
        db.prepare(`
          INSERT OR IGNORE INTO leave_types (name, yearly_quota, is_paid)
          VALUES (?, ?, ?)
        `).run(leave.name, leave.quota, leave.is_paid);
      }

      // 4. Log Audit Entry
      auditService.logAction({
        actorId: adminUserId,
        actorRole: 'ADMIN',
        action: 'SETUP_FIRST_RUN',
        entity: 'COMPANY',
        entityId: '1',
        afterJson: { companyName, adminEmail, officeStartTime, gracePeriod }
      });

      // 5. Generate Token
      const token = jwt.sign(
        { id: adminUserId, email: adminEmail, role: 'ADMIN' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return {
        token,
        user: {
          id: adminUserId,
          email: adminEmail,
          role: 'ADMIN',
          must_change_password: false,
          name: 'Company Admin',
          employee_id: null
        }
      };
    });

    return transaction();
  },

  // User Login
  login({ email, password, ipAddress = null }) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const user = db.prepare(`
      SELECT u.id, u.email, u.password_hash, u.role, u.is_active, u.must_change_password,
             e.id as employee_id, e.first_name, e.last_name, e.department_id
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE LOWER(u.email) = ?
    `).get(email.toLowerCase().trim());

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (!user.is_active) {
      throw new Error('Your account is deactivated. Please contact your administrator.');
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    auditService.logAction({
      actorId: user.id,
      actorRole: user.role,
      action: 'LOGIN',
      entity: 'USER',
      entityId: String(user.id),
      ipAddress
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        must_change_password: Boolean(user.must_change_password),
        employee_id: user.employee_id,
        name: user.first_name ? `${user.first_name} ${user.last_name}` : user.email.split('@')[0],
        department_id: user.department_id
      }
    };
  },

  // Change Password (Required on first sign-in or manual update)
  changePassword({ userId, currentPassword, newPassword, actorRole = null }) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const user = db.prepare(`SELECT id, password_hash, must_change_password FROM users WHERE id = ?`).get(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    // If not first sign-in, verify current password
    if (!user.must_change_password && currentPassword) {
      const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
      if (!isMatch) {
        throw new Error('Current password is incorrect.');
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.prepare(`
      UPDATE users 
      SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newHash, userId);

    auditService.logAction({
      actorId: userId,
      actorRole: actorRole || 'USER',
      action: 'CHANGE_PASSWORD',
      entity: 'USER',
      entityId: String(userId)
    });

    return { success: true, message: 'Password updated successfully.' };
  },

  // Admin creates HR Login
  createHrUser({ email, password }, actorUser) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const existing = db.prepare(`SELECT id FROM users WHERE LOWER(email) = ?`).get(email.toLowerCase().trim());
    if (existing) {
      throw new Error('A user with this email already exists.');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const result = db.prepare(`
      INSERT INTO users (email, password_hash, role, is_active, must_change_password)
      VALUES (?, ?, 'HR', 1, 0)
    `).run(email.toLowerCase().trim(), passwordHash);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'CREATE_HR_USER',
      entity: 'USER',
      entityId: String(result.lastInsertRowid),
      afterJson: { email, role: 'HR' }
    });

    return {
      id: result.lastInsertRowid,
      email: email.toLowerCase().trim(),
      role: 'HR'
    };
  },

  // Admin resets any user's login password
  resetUserPassword({ targetUserId, tempPassword }, actorUser) {
    const target = db.prepare(`SELECT id, email, role FROM users WHERE id = ?`).get(targetUserId);
    if (!target) {
      throw new Error('User not found.');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(tempPassword, salt);

    db.prepare(`
      UPDATE users 
      SET password_hash = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(passwordHash, targetUserId);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'RESET_PASSWORD',
      entity: 'USER',
      entityId: String(targetUserId),
      afterJson: { email: target.email, must_change_password: true }
    });

    return { success: true, message: `Password reset successfully for ${target.email}.` };
  },

  // Admin toggles active status
  toggleUserStatus({ targetUserId, isActive }, actorUser) {
    if (targetUserId === actorUser.id) {
      throw new Error('You cannot deactivate your own account.');
    }

    const target = db.prepare(`SELECT id, email, is_active FROM users WHERE id = ?`).get(targetUserId);
    if (!target) {
      throw new Error('User not found.');
    }

    db.prepare(`
      UPDATE users 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(isActive ? 1 : 0, targetUserId);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entity: 'USER',
      entityId: String(targetUserId),
      beforeJson: { is_active: target.is_active },
      afterJson: { is_active: isActive ? 1 : 0 }
    });

    return { success: true, is_active: Boolean(isActive) };
  },

  // List users (Admin view)
  listUsers({ role = null }) {
    let query = `
      SELECT u.id, u.email, u.role, u.is_active, u.must_change_password, u.created_at,
             e.id as employee_id, e.first_name, e.last_name, e.employee_code
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (role) {
      query += ` AND u.role = ?`;
      params.push(role);
    }
    query += ` ORDER BY u.created_at DESC`;
    return db.prepare(query).all(...params);
  }
};
