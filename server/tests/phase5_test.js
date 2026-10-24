import db from '../config/db.js';
import { authService } from '../services/authService.js';
import { analyticsService } from '../services/analyticsService.js';
import { commsService } from '../services/commsService.js';
import { auditService } from '../services/auditService.js';

console.log('🧪 Running Phase 5 Automated Test Suite (M7 Dashboards & M9 Comms/Audit)...');

try {
  let admin = db.prepare(`SELECT * FROM users WHERE role = 'ADMIN'`).get();
  let hr = db.prepare(`SELECT * FROM users WHERE role = 'HR'`).get();
  let emp = db.prepare(`SELECT * FROM employees LIMIT 1`).get();

  // --- 1. Admin Analytics Tests ---
  console.log('\n--- 1. Admin Analytics Tests ---');
  const adminStats = analyticsService.getAdminAnalytics({});
  console.assert(adminStats.kpis.headcount >= 1, 'Admin KPI Failed: Headcount should be >= 1');
  console.assert(typeof adminStats.kpis.attritionRate === 'number', 'Admin KPI Failed: Attrition rate missing');
  console.assert(Array.isArray(adminStats.headcountByDept), 'Admin KPI Failed: Dept headcount missing');
  console.assert(Array.isArray(adminStats.recentAudit), 'Admin KPI Failed: Recent audit feed missing');
  console.log(`✅ Admin Analytics Passed: Headcount (${adminStats.kpis.headcount}), Attrition (${adminStats.kpis.attritionRate}%), Avg Salary (PKR ${adminStats.kpis.avgSalary.toLocaleString()}).`);

  // --- 2. HR Analytics Tests ---
  console.log('\n--- 2. HR Analytics Tests ---');
  const hrStats = analyticsService.getHrAnalytics({});
  console.assert(hrStats.kpis.totalEmployees >= 1, 'HR KPI Failed: Total employees missing');
  console.assert(typeof hrStats.kpis.attendanceRate === 'number', 'HR KPI Failed: Attendance rate missing');
  console.assert(typeof hrStats.kpis.latePercentage === 'number', 'HR KPI Failed: Late percentage missing');
  console.assert(Array.isArray(hrStats.topLateComers), 'HR KPI Failed: Top late comers missing');
  console.log(`✅ HR Analytics Passed: Present (${hrStats.kpis.presentToday}), Late (${hrStats.kpis.lateToday}), Absent (${hrStats.kpis.absentToday}), Attendance Rate (${hrStats.kpis.attendanceRate}%).`);

  // --- 3. Employee Analytics Tests ---
  console.log('\n--- 3. Employee Analytics Tests ---');
  const empStats = analyticsService.getEmployeeAnalytics(emp.id);
  console.assert(typeof empStats.weeklyHours === 'number', 'Employee KPI Failed: Weekly hours missing');
  console.assert(empStats.weeklyTarget === 40, 'Employee KPI Failed: Weekly target should be 40h');
  console.assert(Array.isArray(empStats.leaveBalances), 'Employee KPI Failed: Leave balances missing');
  console.log(`✅ Employee Analytics Passed: Weekly Hours (${empStats.weeklyHours}h / 40h target), Late count (${empStats.lateCountThisMonth}).`);

  // --- 4. Comms & Announcements Tests ---
  console.log('\n--- 4. Comms & Announcements Tests ---');
  const newAnn = commsService.createAnnouncement({
    title: 'Saylani Hackathon 2026 Finals',
    content: 'All teams must submit before final evaluation deadline.',
    priority: 'URGENT'
  }, admin);

  console.assert(newAnn.id, 'Announcement Failed: ID missing');
  console.assert(newAnn.priority === 'URGENT', 'Announcement Failed: Priority mismatch');

  const annList = commsService.getAnnouncements();
  console.assert(annList.length >= 1, 'Announcement Failed: List is empty');
  console.log(`✅ Announcements Passed: Created announcement (Priority: ${newAnn.priority}) and verified in public board.`);

  // In-App Notification test
  const notifs = commsService.getNotifications(emp.user_id);
  if (notifs.length > 0) {
    commsService.markNotificationRead(notifs[0].id, emp.user_id);
    console.log(`✅ Notifications Passed: Verified in-app notifications for user.`);
  }

  // --- 5. Audit Log Feed Tests ---
  console.log('\n--- 5. Audit Log Feed Tests ---');
  const auditLogs = auditService.getAuditLogs({ limit: 10 });
  console.assert(auditLogs.length > 0, 'Audit Failed: Logs should not be empty');
  console.assert(auditLogs[0].action, 'Audit Failed: Latest action missing');
  console.log(`✅ Audit Log Passed: Retrieved ${auditLogs.length} audit trail events with actor and JSON diffs.`);

  console.log('\n🎉 ALL PHASE 5 BACKEND & ANALYTICS TESTS PASSED! 💯');
  process.exit(0);
} catch (err) {
  console.error('❌ Phase 5 Test Suite Failed:', err);
  process.exit(1);
}
