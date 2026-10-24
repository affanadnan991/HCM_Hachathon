import db from '../config/db.js';

export const auditService = {
  logAction({ actorId = null, actorRole = null, action, entity, entityId = null, beforeJson = null, afterJson = null, ipAddress = null }) {
    try {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id, before_json, after_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const beforeStr = beforeJson ? (typeof beforeJson === 'string' ? beforeJson : JSON.stringify(beforeJson)) : null;
      const afterStr = afterJson ? (typeof afterJson === 'string' ? afterJson : JSON.stringify(afterJson)) : null;

      stmt.run(actorId, actorRole, action, entity, entityId ? String(entityId) : null, beforeStr, afterStr, ipAddress);
    } catch (err) {
      console.error('Audit Log Error:', err.message);
    }
  },

  getAuditLogs({ limit = 50, offset = 0, entity = null, actorId = null }) {
    let query = `
      SELECT 
        a.id, a.actor_id, a.actor_role, a.action, a.entity, a.entity_id, 
        a.before_json, a.after_json, a.ip_address, a.created_at,
        u.email as actor_email,
        e.first_name || ' ' || e.last_name as actor_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (entity) {
      query += ` AND a.entity = ?`;
      params.push(entity);
    }
    if (actorId) {
      query += ` AND a.actor_id = ?`;
      params.push(actorId);
    }

    query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return db.prepare(query).all(...params);
  }
};
