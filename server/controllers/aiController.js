import { aiService } from '../services/aiService.js';
import db from '../config/db.js';

export const aiController = {
  async chat(req, res, next) {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required.' });
      }

      const response = await aiService.handleChat({
        prompt: prompt.trim(),
        user: req.user
      });

      res.json(response);
    } catch (err) {
      if (err.message && err.message.includes('Rate limit exceeded')) {
        return res.status(429).json({ error: err.message });
      }
      next(err);
    }
  },

  async summarize(req, res, next) {
    try {
      const { kpis } = req.body;
      if (!kpis || typeof kpis !== 'object') {
        return res.status(400).json({ error: 'Valid KPI object is required.' });
      }

      const summary = aiService.summarizeDashboard(kpis, req.user.role);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },

  async getAiLogs(req, res, next) {
    try {
      const logs = db.prepare(`
        SELECT l.*, u.email, u.name
        FROM ai_logs l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 50
      `).all();

      res.json({ logs });
    } catch (err) {
      next(err);
    }
  }
};
