import jwt from 'jsonwebtoken';
import db from '../config/db.js';

export function authGuard(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'saylani_hcm_lite_super_secure_jwt_secret_key_2026';
    
    const decoded = jwt.verify(token, secret);
    
    // Check if user exists and is active in database
    const user = db.prepare(`
      SELECT u.id, u.email, u.role, u.is_active, u.must_change_password,
             e.id as employee_id, e.first_name, e.last_name, e.department_id
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.id = ?
    `).get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User no longer exists' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Forbidden: Account has been deactivated' });
    }

    // Attach verified user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      must_change_password: Boolean(user.must_change_password),
      employee_id: user.employee_id,
      name: user.first_name ? `${user.first_name} ${user.last_name}` : user.email.split('@')[0],
      department_id: user.department_id
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Token has expired' });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token signature' });
  }
}

export function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]. Your role is ${req.user.role}` 
      });
    }

    next();
  };
}

export function employeeScopeGuard(req, res, next) {
  // If user is Admin or HR, they have company-wide scope
  if (req.user.role === 'ADMIN' || req.user.role === 'HR') {
    return next();
  }

  // If user is Employee, ensure they can only query or touch their own employee_id
  const targetEmployeeId = req.params.employeeId || req.query.employee_id || req.body.employee_id;
  
  if (targetEmployeeId && Number(targetEmployeeId) !== Number(req.user.employee_id)) {
    return res.status(403).json({ 
      error: 'Forbidden: Access denied. Employees can only access their own data.' 
    });
  }

  next();
}
