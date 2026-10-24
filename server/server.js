import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import { authService } from './services/authService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database schema and tables
initDatabase();

// Check if auto-bootstrap is requested via .env
try {
  const status = authService.checkFirstRunStatus();
  if (status.isFirstRun && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    console.log('⚡ Bootstrapping Admin account from .env variables...');
    authService.bootstrapAdmin({
      companyName: 'HCM Lite Technologies',
      adminEmail: process.env.ADMIN_EMAIL,
      adminPassword: process.env.ADMIN_PASSWORD
    });
    console.log('✅ Bootstrap Admin created successfully!');
  }
} catch (err) {
  console.log('Setup notice:', err.message);
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'HCM Lite Backend'
  });
});

import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import commsRoutes from './routes/commsRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/comms', commsRoutes);
app.use('/api/ai', aiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 HCM Lite Server running on http://localhost:${PORT}`);
});

export default app;
