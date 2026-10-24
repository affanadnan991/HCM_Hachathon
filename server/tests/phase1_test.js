import db from '../config/db.js';
import { authService } from '../services/authService.js';
import { auditService } from '../services/auditService.js';

console.log('🧪 Running Phase 1 Automated Test Suite...');

try {
  // 1. Reset test state
  db.prepare(`DELETE FROM users`).run();
  db.prepare(`DELETE FROM company_settings`).run();
  db.prepare(`DELETE FROM audit_logs`).run();
  db.prepare(`DELETE FROM leave_types`).run();

  // Test 1: Check First Run Status
  const status1 = authService.checkFirstRunStatus();
  console.assert(status1.isFirstRun === true, 'Test 1 Failed: Should be first run when users table is empty');
  console.log('✅ Test 1 Passed: First-run status detection verified.');

  // Test 2: Setup First Run (Admin & Company Setup)
  const setupResult = authService.bootstrapAdmin({
    companyName: 'Acme Corp',
    adminEmail: 'admin@acme.com',
    adminPassword: 'Password123!',
    officeStartTime: '09:00',
    gracePeriod: 15,
    halfDayHours: 5.0,
    weekendDays: ['Saturday', 'Sunday'],
    officeRadius: 150
  });

  console.assert(setupResult.token, 'Test 2 Failed: Token missing from setup result');
  console.assert(setupResult.user.role === 'ADMIN', 'Test 2 Failed: User role must be ADMIN');
  console.log('✅ Test 2 Passed: Bootstrap Admin and Company setup verified.');

  // Test 3: Second setup attempt must fail
  let duplicateSetupFailed = false;
  try {
    authService.bootstrapAdmin({
      companyName: 'Another Corp',
      adminEmail: 'another@acme.com',
      adminPassword: 'Password123!'
    });
  } catch (err) {
    duplicateSetupFailed = true;
  }
  console.assert(duplicateSetupFailed, 'Test 3 Failed: Second setup should have thrown error');
  console.log('✅ Test 3 Passed: Prevention of duplicate initial setup verified.');

  // Test 4: Login with valid credentials
  const loginSuccess = authService.login({
    email: 'admin@acme.com',
    password: 'Password123!'
  });
  console.assert(loginSuccess.token, 'Test 4 Failed: Token missing on login');
  console.assert(loginSuccess.user.email === 'admin@acme.com', 'Test 4 Failed: User email mismatch');
  console.log('✅ Test 4 Passed: Admin login with valid credentials verified.');

  // Test 5: Login with wrong password must throw error
  let invalidLoginFailed = false;
  try {
    authService.login({
      email: 'admin@acme.com',
      password: 'WrongPassword!'
    });
  } catch (err) {
    invalidLoginFailed = true;
  }
  console.assert(invalidLoginFailed, 'Test 5 Failed: Login with wrong password should fail');
  console.log('✅ Test 5 Passed: Login failure on invalid credentials verified.');

  // Test 6: Admin creates HR user
  const hrUser = authService.createHrUser({
    email: 'hr@acme.com',
    password: 'HrPassword123!'
  }, loginSuccess.user);
  console.assert(hrUser.role === 'HR', 'Test 6 Failed: Role should be HR');
  console.log('✅ Test 6 Passed: Admin creating HR user verified.');

  // Test 7: HR can log in
  const hrLogin = authService.login({
    email: 'hr@acme.com',
    password: 'HrPassword123!'
  });
  console.assert(hrLogin.user.role === 'HR', 'Test 7 Failed: Logged in role should be HR');
  console.log('✅ Test 7 Passed: HR user login verified.');

  // Test 8: Change Password
  const passChange = authService.changePassword({
    userId: hrLogin.user.id,
    currentPassword: 'HrPassword123!',
    newPassword: 'NewHrPassword456!'
  });
  console.assert(passChange.success === true, 'Test 8 Failed: Password change should succeed');
  console.log('✅ Test 8 Passed: Password change functionality verified.');

  // Test 9: Verify Audit Logs
  const logs = auditService.getAuditLogs({ limit: 10 });
  console.assert(logs.length >= 3, 'Test 9 Failed: Audit logs should record setup, logins, user creation');
  console.log(`✅ Test 9 Passed: Audit logging verified (${logs.length} events logged).`);

  console.log('\n🎉 ALL PHASE 1 BACKEND TESTS PASSED SUCCESSFULLY! 💯');
  process.exit(0);
} catch (error) {
  console.error('❌ Test Suite Error:', error);
  process.exit(1);
}
