import db from '../config/db.js';
import { auditService } from './auditService.js';

export const commsService = {
  // Announcements
  getAnnouncements() {
    return db.prepare(`
      SELECT a.*, u.email as author_email, u.role as author_role
      FROM announcements a
      JOIN users u ON a.posted_by = u.id
      ORDER BY a.created_at DESC
    `).all();
  },

  createAnnouncement({ title, content, priority = 'NORMAL' }, actorUser) {
    if (!title || !content) {
      throw new Error('Title and content are required.');
    }

    const result = db.prepare(`
      INSERT INTO announcements (title, content, priority, posted_by)
      VALUES (?, ?, ?, ?)
    `).run(title.trim(), content.trim(), priority, actorUser.id);

    const created = db.prepare(`SELECT * FROM announcements WHERE id = ?`).get(result.lastInsertRowid);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'POST_ANNOUNCEMENT',
      entity: 'ANNOUNCEMENT',
      entityId: String(created.id),
      afterJson: created
    });

    return created;
  },

  deleteAnnouncement(id, actorUser) {
    const existing = db.prepare(`SELECT * FROM announcements WHERE id = ?`).get(id);
    if (!existing) {
      throw new Error('Announcement not found.');
    }

    db.prepare(`DELETE FROM announcements WHERE id = ?`).run(id);

    auditService.logAction({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'DELETE_ANNOUNCEMENT',
      entity: 'ANNOUNCEMENT',
      entityId: String(id),
      beforeJson: existing
    });

    return { success: true };
  },

  // In-App Notifications
  getNotifications(userId) {
    return db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all(userId);
  },

  markNotificationRead(notificationId, userId) {
    db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);

    return { success: true };
  },

  markAllNotificationsRead(userId) {
    db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ?
    `).run(userId);

    return { success: true };
  }
};
