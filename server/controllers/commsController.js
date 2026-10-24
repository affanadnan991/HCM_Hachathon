import { commsService } from '../services/commsService.js';

export const commsController = {
  getAnnouncements(req, res) {
    try {
      const list = commsService.getAnnouncements();
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  createAnnouncement(req, res) {
    try {
      const created = commsService.createAnnouncement(req.body, req.user);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  deleteAnnouncement(req, res) {
    try {
      const result = commsService.deleteAnnouncement(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  getNotifications(req, res) {
    try {
      const list = commsService.getNotifications(req.user.id);
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  markRead(req, res) {
    try {
      const result = commsService.markNotificationRead(req.params.id, req.user.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  markAllRead(req, res) {
    try {
      const result = commsService.markAllNotificationsRead(req.user.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};
