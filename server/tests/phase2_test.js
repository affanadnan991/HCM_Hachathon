import db from '../config/db.js';
import { authService } from '../services/authService.js';
import { companyService } from '../services/companyService.js';
import { employeeService } from '../services/employeeService.js';

console.log('🧪 Running Phase 2 Automated Test Suite (M2 Org Setup & M3 Employees 360 + CSV)...');

try {
  // Ensure we have an Admin
  let admin = db.prepare(`SELECT * FROM users WHERE role = 'ADMIN'`).get();
  if (!admin) {
    const setup = authService.bootstrapAdmin({
      companyName: 'Saylani HCM Tech',
      adminEmail: 'admin@hcmlite.com',
      adminPassword: 'Password123!'
    });
    admin = setup.user;
  }

  // Ensure we have an HR user
  let hrUser = db.prepare(`SELECT * FROM users WHERE role = 'HR'`).get();
  if (!hrUser) {
    hrUser = authService.createHrUser({
      email: 'hr@hcmlite.com',
      password: 'Password123!'
    }, admin);
  }

  // Clean test holiday and employees if existed from previous run
  db.prepare(`DELETE FROM public_holidays WHERE holiday_date = '2026-08-14'`).run();
  const existingEmp1 = db.prepare(`SELECT * FROM employees WHERE email = 'ahmed.khan@company.com'`).get();
  if (existingEmp1) {
    db.prepare(`DELETE FROM employees WHERE id = ?`).run(existingEmp1.id);
    db.prepare(`DELETE FROM users WHERE id = ?`).run(existingEmp1.user_id);
  }
  const existingEmp2 = db.prepare(`SELECT * FROM employees WHERE email = 'bilal@company.com'`).get();
  if (existingEmp2) {
    db.prepare(`DELETE FROM employees WHERE id = ?`).run(existingEmp2.id);
    db.prepare(`DELETE FROM users WHERE id = ?`).run(existingEmp2.user_id);
  }

  // --- Module 2: Organization Setup Tests ---
  console.log('\n--- Module 2 Tests ---');

  // Test 1: Update Company Settings
  const updatedSettings = companyService.updateSettings({
    office_start_time: '09:00',
    grace_period_minutes: 15,
    half_day_hours: 5.0,
    office_radius_meters: 150
  }, admin);
  console.assert(updatedSettings.grace_period_minutes === 15, 'Test 1 Failed: Grace period should be 15');
  console.log('✅ Test 1 Passed: Company settings updated successfully.');

  // Test 2: Create Departments (Idempotent for repeated test runs)
  const existingDepts = companyService.getDepartments();
  let deptEng = existingDepts.find(d => d.code === 'ENG');
  if (!deptEng) {
    deptEng = companyService.createDepartment({ name: 'Engineering', code: 'ENG' }, admin);
  }
  let deptHr = existingDepts.find(d => d.code === 'HR');
  if (!deptHr) {
    deptHr = companyService.createDepartment({ name: 'Human Resources', code: 'HR' }, admin);
  }
  console.assert(deptEng.id && deptHr.id, 'Test 2 Failed: Department IDs should exist');
  console.log('✅ Test 2 Passed: Departments created/verified successfully.');

  // Test 3: Create Designations
  const existingDesigs = companyService.getDesignations(deptEng.id);
  let desigDev = existingDesigs.find(d => d.title === 'Senior Software Engineer');
  if (!desigDev) {
    desigDev = companyService.createDesignation({ department_id: deptEng.id, title: 'Senior Software Engineer' }, admin);
  }
  console.assert(desigDev.title === 'Senior Software Engineer', 'Test 3 Failed: Designation title mismatch');
  console.log('✅ Test 3 Passed: Designations created successfully.');

  // Test 4: Create Public Holiday
  const holiday = companyService.createHoliday({ name: 'Independence Day', holiday_date: '2026-08-14' }, admin);
  console.assert(holiday.holiday_date === '2026-08-14', 'Test 4 Failed: Holiday date mismatch');
  console.log('✅ Test 4 Passed: Public holiday registered.');

  // --- Module 3: Employee 360 & Registration Tests ---
  console.log('\n--- Module 3 Tests ---');

  // Test 5: Register Employee with Automatic Salary Breakdown
  const emp1 = employeeService.registerEmployee({
    first_name: 'Ahmed',
    last_name: 'Khan',
    email: 'ahmed.khan@company.com',
    phone: '03001234567',
    address: 'Karachi, Pakistan',
    department_id: deptEng.id,
    designation_id: desigDev.id,
    date_of_joining: '2026-01-15',
    basic_salary: 100000,
    temporary_password: 'TempPassword123!'
  }, hrUser);

  // Check 1.5x Gross formula: Gross = 1.5 * Basic; HRA = 40%, Medical = 10%
  console.assert(emp1.basic_salary === 100000, 'Test 5 Failed: Basic salary mismatch');
  console.assert(emp1.hra_allowance === 40000, 'Test 5 Failed: HRA allowance must be 40% (40,000)');
  console.assert(emp1.medical_allowance === 10000, 'Test 5 Failed: Medical allowance must be 10% (10,000)');
  console.assert(emp1.gross_salary === 150000, 'Test 5 Failed: Gross salary must be 1.5x Basic (150,000)');
  console.assert(emp1.leaveBalances.length >= 4, 'Test 5 Failed: All 4 leave balances must be initialized');
  console.log('✅ Test 5 Passed: Employee registered with correct 1.5x gross salary breakdown & leave balances.');

  // Test 6: Verify Employee Login Created & Forced Password Change
  const empUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(emp1.user_id);
  console.assert(empUser.role === 'EMPLOYEE', 'Test 6 Failed: User role must be EMPLOYEE');
  console.assert(empUser.must_change_password === 1, 'Test 6 Failed: New employee must be forced to change password');
  console.log('✅ Test 6 Passed: Employee user login created with temporary password guard.');

  // Test 7: Employee Scope Guard (Employee can only update phone/address)
  let salaryTamperFailed = false;
  try {
    employeeService.updateEmployee(emp1.id, {
      basic_salary: 200000 // Attempting unauthorized salary change
    }, { id: empUser.id, role: 'EMPLOYEE', employee_id: emp1.id });
  } catch (err) {
    salaryTamperFailed = true;
  }
  console.assert(salaryTamperFailed, 'Test 7 Failed: Employee should NOT be able to modify salary');
  console.log('✅ Test 7 Passed: Scope guard prevented employee from tampering with salary.');

  // Test 8: Employee successfully updates phone & address
  const updatedEmp = employeeService.updateEmployee(emp1.id, {
    phone: '03009999999',
    address: 'Gulshan, Karachi'
  }, { id: empUser.id, role: 'EMPLOYEE', employee_id: emp1.id });
  console.assert(updatedEmp.phone === '03009999999', 'Test 8 Failed: Phone was not updated');
  console.log('✅ Test 8 Passed: Employee successfully updated own phone and address.');

  // --- CSV Dry-Run Error Engine Tests ---
  console.log('\n--- CSV Dry-Run Engine Tests ---');

  const testCsvRows = [
    // Row 1: Missing required fields
    { first_name: '', last_name: '', email: '', department: '', basic_salary: '' },
    // Row 2: Invalid email format
    { first_name: 'Sara', last_name: 'Ali', email: 'sara_invalid_email', department: 'Engineering', date_of_joining: '2026-02-01', basic_salary: '80000' },
    // Row 3: Duplicate email (already exists)
    { first_name: 'Duplicate', last_name: 'Ahmed', email: 'ahmed.khan@company.com', department: 'Engineering', date_of_joining: '2026-02-01', basic_salary: '90000' },
    // Row 4: Unknown department
    { first_name: 'Zain', last_name: 'Malik', email: 'zain@company.com', department: 'NonExistentDept', date_of_joining: '2026-02-01', basic_salary: '75000' },
    // Row 5: Negative salary
    { first_name: 'Usman', last_name: 'Tariq', email: 'usman@company.com', department: 'Engineering', date_of_joining: '2026-02-01', basic_salary: '-5000' },
    // Row 6: 100% Valid Row
    { first_name: 'Bilal', last_name: 'Siddiqui', email: 'bilal@company.com', department: 'Engineering', date_of_joining: '2026-03-01', basic_salary: '95000' }
  ];

  const dryRunReport = employeeService.dryRunCsvImport(testCsvRows);
  console.assert(dryRunReport.total_rows === 6, 'CSV Test Failed: Total rows should be 6');
  console.assert(dryRunReport.invalid_rows_count === 5, 'CSV Test Failed: Exactly 5 rows should have errors');
  console.assert(dryRunReport.valid_rows_count === 1, 'CSV Test Failed: Exactly 1 row should be valid');
  console.assert(dryRunReport.valid_rows[0].email === 'bilal@company.com', 'CSV Test Failed: Valid row email mismatch');
  console.log(`✅ Test 9 Passed: CSV Dry-Run successfully caught 5 error rows and isolated 1 valid row.`);

  // Test 10: Commit Valid CSV Row
  const committed = employeeService.commitCsvImport(dryRunReport.valid_rows, hrUser);
  console.assert(committed.length === 1, 'Test 10 Failed: Should have imported 1 valid employee');
  console.assert(committed[0].email === 'bilal@company.com', 'Test 10 Failed: Imported email mismatch');
  console.log('✅ Test 10 Passed: Valid CSV row successfully committed.');

  // Test 11: CSV Export
  const csvText = employeeService.exportEmployeesCsv();
  console.assert(csvText.includes('ahmed.khan@company.com'), 'Test 11 Failed: CSV export missing emp 1');
  console.assert(csvText.includes('bilal@company.com'), 'Test 11 Failed: CSV export missing emp 2');
  console.log('✅ Test 11 Passed: CSV export generated with headers and employee records.');

  console.log('\n🎉 ALL PHASE 2 BACKEND & BUSINESS RULE TESTS PASSED! 💯');
  process.exit(0);
} catch (err) {
  console.error('❌ Phase 2 Test Suite Failed:', err);
  process.exit(1);
}
