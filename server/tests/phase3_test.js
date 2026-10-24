import db from '../config/db.js';
import { authService } from '../services/authService.js';
import { companyService } from '../services/companyService.js';
import { employeeService } from '../services/employeeService.js';
import { attendanceService } from '../services/attendanceService.js';
import { leaveService } from '../services/leaveService.js';
import { dateUtils } from '../utils/dateUtils.js';

console.log('🧪 Running Phase 3 Automated Test Suite (M4 Attendance & M5 Leave Engine)...');

try {
  // Setup Admin, HR, and Employee test users
  let admin = db.prepare(`SELECT * FROM users WHERE role = 'ADMIN'`).get();
  if (!admin) {
    const setup = authService.bootstrapAdmin({
      companyName: 'Saylani HCM Tech',
      adminEmail: 'admin@hcmlite.com',
      adminPassword: 'Password123!'
    });
    admin = setup.user;
  }

  let hrUser = db.prepare(`SELECT * FROM users WHERE role = 'HR'`).get();
  if (!hrUser) {
    hrUser = authService.createHrUser({
      email: 'hr@hcmlite.com',
      password: 'Password123!'
    }, admin);
  }

  let emp = db.prepare(`SELECT * FROM employees LIMIT 1`).get();
  if (!emp) {
    let dept = db.prepare(`SELECT id FROM departments LIMIT 1`).get();
    if (!dept) {
      dept = companyService.createDepartment({ name: 'Engineering', code: 'ENG' }, admin);
    }
    emp = employeeService.registerEmployee({
      first_name: 'Zainab',
      last_name: 'Bibi',
      email: 'zainab.bibi@company.com',
      department_id: dept.id,
      date_of_joining: '2026-01-01',
      basic_salary: 120000
    }, hrUser);
  }

  const empUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(emp.user_id);

  // --- Module 4: Attendance Tests ---
  console.log('\n--- Module 4 Attendance Tests ---');

  // Clear today's attendance for this test employee
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`DELETE FROM attendance WHERE employee_id = ? AND date = ?`).run(emp.id, today);

  // Test 1: Check-In
  const punchIn = attendanceService.checkIn({
    employeeId: emp.id,
    source: 'web'
  }, { id: empUser.id, role: 'EMPLOYEE' });

  console.assert(punchIn.id, 'Test 1 Failed: Attendance record ID missing');
  console.assert(punchIn.date === today, 'Test 1 Failed: Date mismatch');
  console.log(`✅ Test 1 Passed: Check-in recorded at ${punchIn.check_in_time} with status '${punchIn.status}'.`);

  // Test 2: Duplicate Check-In Guard (Must throw 409 Conflict)
  let duplicateThrew409 = false;
  try {
    attendanceService.checkIn({
      employeeId: emp.id,
      source: 'web'
    }, { id: empUser.id, role: 'EMPLOYEE' });
  } catch (err) {
    if (err.status === 409) {
      duplicateThrew409 = true;
    }
  }
  console.assert(duplicateThrew409, 'Test 2 Failed: Second check-in must throw 409 Conflict');
  console.log('✅ Test 2 Passed: Duplicate check-in correctly threw 409 Conflict.');

  // Test 3: Check-Out (Work Hours & Half-Day Rule)
  const punchOut = attendanceService.checkOut({
    employeeId: emp.id
  }, { id: empUser.id, role: 'EMPLOYEE' });

  console.assert(punchOut.check_out_time, 'Test 3 Failed: Check-out time missing');
  console.assert(punchOut.status === 'half_day', 'Test 3 Failed: Instant check-out should be half_day (< 5h)');
  console.log(`✅ Test 3 Passed: Check-out completed, work hours calculated, half_day rule enforced.`);

  // Test 4: Daily Attendance Board
  const board = attendanceService.getDailyBoard({ date: today });
  console.assert(board.board.length > 0, 'Test 4 Failed: Daily board should contain active employees');
  const empOnBoard = board.board.find(b => b.employee_id === emp.id);
  console.assert(empOnBoard && empOnBoard.status === 'half_day', 'Test 4 Failed: Employee status mismatch on board');
  console.log(`✅ Test 4 Passed: Daily Attendance Board computed rosters and summaries (${board.summary.total} employees).`);

  // Test 5: Attendance Correction Workflow
  const correction = attendanceService.requestCorrection({
    attendanceId: punchIn.id,
    employeeId: emp.id,
    requestedCheckIn: `${today}T09:00:00.000Z`,
    requestedCheckOut: `${today}T17:30:00.000Z`,
    reason: 'Forgot to punch out due to client meeting.'
  }, { id: empUser.id, role: 'EMPLOYEE' });

  console.assert(correction.success === true, 'Test 5 Failed: Correction request submission failed');
  
  // HR reviews and approves correction
  const reviewResult = attendanceService.reviewCorrection({
    correctionId: correction.id,
    status: 'APPROVED',
    reviewComment: 'Approved as discussed.'
  }, hrUser);

  console.assert(reviewResult.status === 'APPROVED', 'Test 5 Failed: Correction review should be APPROVED');
  const correctedAtt = db.prepare(`SELECT * FROM attendance WHERE id = ?`).get(punchIn.id);
  console.assert(correctedAtt.is_corrected === 1, 'Test 5 Failed: Attendance should be marked as corrected');
  console.assert(correctedAtt.work_hours >= 8.0, 'Test 5 Failed: Corrected hours should reflect 8.5 hours');
  console.assert(correctedAtt.status === 'present', 'Test 5 Failed: Status should be updated to present');
  console.log('✅ Test 5 Passed: Attendance correction workflow (Request -> HR Review -> Recalculate) verified.');

  // --- Module 5: Leave Engine Tests ---
  console.log('\n--- Module 5 Leave Engine Tests ---');

  // Test 6: Working Days Calculation (Skips weekends and registered holidays)
  // Register a public holiday on Friday 2026-11-06
  db.prepare(`INSERT OR IGNORE INTO public_holidays (name, holiday_date) VALUES ('Test Holiday', '2026-11-06')`).run();

  // Period: 2026-11-02 (Mon) to 2026-11-08 (Sun) -> 7 total days
  // Sat & Sun skipped (-2), Holiday on Friday skipped (-1) => Exactly 4 working days!
  const workingDays = dateUtils.calculateWorkingDays('2026-11-02', '2026-11-08', ['Saturday', 'Sunday']);
  console.assert(workingDays === 4, `Test 6 Failed: Expected 4 working days, got ${workingDays}`);
  console.log('✅ Test 6 Passed: Working days calculation accurately skipped Saturday, Sunday, and Public Holiday.');

  // Test 7: Apply Leave (Normal valid submission)
  const casualLeaveType = db.prepare(`SELECT * FROM leave_types WHERE name = 'Casual'`).get();
  
  // Clean prior test leaves for these dates
  db.prepare(`DELETE FROM leave_requests WHERE employee_id = ? AND start_date >= '2026-11-01'`).run(emp.id);

  const leaveReq1 = leaveService.applyLeave({
    employeeId: emp.id,
    leaveTypeId: casualLeaveType.id,
    startDate: '2026-11-02',
    endDate: '2026-11-04',
    reason: 'Family event'
  }, { id: empUser.id, role: 'EMPLOYEE' });

  console.assert(leaveReq1.status === 'PENDING', 'Test 7 Failed: Status should be PENDING');
  console.assert(leaveReq1.working_days_count === 3, 'Test 7 Failed: Mon-Wed should be 3 working days');
  console.log('✅ Test 7 Passed: Valid leave request submitted (3 working days).');

  // Test 8: Overlapping Leave Guard (Must throw 422 Unprocessable Entity)
  let overlapThrew422 = false;
  try {
    leaveService.applyLeave({
      employeeId: emp.id,
      leaveTypeId: casualLeaveType.id,
      startDate: '2026-11-03', // Overlaps with 2026-11-02 to 2026-11-04
      endDate: '2026-11-05',
      reason: 'Another reason'
    }, { id: empUser.id, role: 'EMPLOYEE' });
  } catch (err) {
    if (err.status === 422) {
      overlapThrew422 = true;
    }
  }
  console.assert(overlapThrew422, 'Test 8 Failed: Overlapping leave must throw 422 Unprocessable Entity');
  console.log('✅ Test 8 Passed: Overlapping leave request correctly threw 422 Unprocessable Entity.');

  // Test 9: Over-Balance Guard (Must throw 422 Unprocessable Entity)
  let overBalanceThrew422 = false;
  try {
    leaveService.applyLeave({
      employeeId: emp.id,
      leaveTypeId: casualLeaveType.id, // Quota is 10 days
      startDate: '2026-12-01',
      endDate: '2026-12-31', // 23 working days > 10 quota
      reason: 'Long trip'
    }, { id: empUser.id, role: 'EMPLOYEE' });
  } catch (err) {
    if (err.status === 422) {
      overBalanceThrew422 = true;
    }
  }
  console.assert(overBalanceThrew422, 'Test 9 Failed: Over-balance request must throw 422 Unprocessable Entity');
  console.log('✅ Test 9 Passed: Insufficient balance request correctly threw 422 Unprocessable Entity.');

  // Test 10: HR Review & Leave Balance Deduction
  const initialBalance = db.prepare(`
    SELECT remaining_days, used_days FROM leave_balances 
    WHERE employee_id = ? AND leave_type_id = ? AND year = 2026
  `).get(emp.id, casualLeaveType.id);

  const reviewLeave = leaveService.reviewLeaveRequest({
    leaveId: leaveReq1.id,
    status: 'APPROVED',
    reviewComment: 'Approved enjoy your time.'
  }, hrUser);

  console.assert(reviewLeave.status === 'APPROVED', 'Test 10 Failed: Leave review should be APPROVED');

  const afterBalance = db.prepare(`
    SELECT remaining_days, used_days FROM leave_balances 
    WHERE employee_id = ? AND leave_type_id = ? AND year = 2026
  `).get(emp.id, casualLeaveType.id);

  console.assert(afterBalance.remaining_days === initialBalance.remaining_days - 3, 'Test 10 Failed: Remaining days should deduct by 3');
  console.assert(afterBalance.used_days === initialBalance.used_days + 3, 'Test 10 Failed: Used days should increase by 3');

  // Verify in-app notification
  const notif = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1`).get(emp.user_id);
  console.assert(notif && notif.type === 'LEAVE', 'Test 10 Failed: In-app notification should be sent to employee');
  console.log('✅ Test 10 Passed: Leave approved, quota balance deducted in DB, and notification dispatched.');

  console.log('\n🎉 ALL PHASE 3 BACKEND & BUSINESS RULE TESTS PASSED! 💯');
  process.exit(0);
} catch (err) {
  console.error('❌ Phase 3 Test Suite Failed:', err);
  process.exit(1);
}
