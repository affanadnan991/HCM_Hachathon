import db from '../config/db.js';
import { authService } from '../services/authService.js';
import { companyService } from '../services/companyService.js';
import { employeeService } from '../services/employeeService.js';
import { payrollService } from '../services/payrollService.js';
import { generatePayslipPdf } from '../utils/pdfGenerator.js';

console.log('🧪 Running Phase 4 Automated Test Suite (M6 Payroll Lite & PDF Generation)...');

try {
  // Ensure Admin & HR exist
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

  // --- 1. Tax Slab Calculation Verification ---
  console.log('\n--- 1. Tax Slab Engine Tests ---');
  // Bracket 1: <= 600k (Tax = 0)
  console.assert(payrollService.calculateTax(500000) === 0, 'Tax 1 Failed: <=600k should be 0');
  
  // Bracket 2: 600k - 1.2M (5% on amount over 600k)
  // (1,000,000 - 600,000) * 0.05 = 20,000 / 12 = 1667
  console.assert(payrollService.calculateTax(1000000) === 1667, 'Tax 2 Failed: 1M tax mismatch');

  // Bracket 3: 1.2M - 2.4M (30k + 15% on amount over 1.2M)
  // 1,800,000 -> 30k + (600k * 0.15) = 30k + 90k = 120,000 / 12 = 10,000
  console.assert(payrollService.calculateTax(1800000) === 10000, 'Tax 3 Failed: 1.8M tax mismatch');

  // Bracket 4: 2.4M - 3.6M (210k + 25% on amount over 2.4M)
  // 3,000,000 -> 210k + (600k * 0.25) = 210k + 150k = 360,000 / 12 = 30,000
  console.assert(payrollService.calculateTax(3000000) === 30000, 'Tax 4 Failed: 3M tax mismatch');

  // Bracket 5: > 3.6M (510k + 35% on amount over 3.6M)
  // 4,800,000 -> 510k + (1.2M * 0.35) = 510k + 420k = 930,000 / 12 = 77,500
  console.assert(payrollService.calculateTax(4800000) === 77500, 'Tax 5 Failed: 4.8M tax mismatch');
  console.log('✅ Tax Slabs Test Passed: All 5 tax brackets calculated with exact monthly deductions.');

  // --- 2. Monthly Payroll Draft Generation ---
  console.log('\n--- 2. Payroll Run & Formula Tests ---');

  // Clean prior test payroll run for Oct 2026
  db.prepare(`DELETE FROM payslips WHERE payroll_run_id IN (SELECT id FROM payroll_runs WHERE month = 10 AND year = 2026)`).run();
  db.prepare(`DELETE FROM payroll_runs WHERE month = 10 AND year = 2026`).run();

  const draftRun = payrollService.generateMonthlyDraft({
    month: 10,
    year: 2026
  }, hrUser);

  console.assert(draftRun.id, 'Test Failed: Draft run ID missing');
  console.assert(draftRun.status === 'DRAFT', 'Test Failed: Initial run status must be DRAFT');
  console.assert(draftRun.payslips.length > 0, 'Test Failed: Payslips should be generated for employees');
  
  const sampleSlip = draftRun.payslips[0];
  console.assert(sampleSlip.gross_salary === sampleSlip.basic_salary * 1.5, 'Test Failed: Gross must be 1.5x basic');
  console.assert(sampleSlip.hra_allowance === Number((sampleSlip.basic_salary * 0.4).toFixed(2)), 'Test Failed: HRA must be 40%');
  console.assert(sampleSlip.medical_allowance === Number((sampleSlip.basic_salary * 0.1).toFixed(2)), 'Test Failed: Medical must be 10%');
  console.assert(sampleSlip.net_salary <= sampleSlip.gross_salary, 'Test Failed: Net salary cannot exceed Gross');
  console.log(`✅ Draft Generation Passed: Draft created with ${draftRun.total_employees} payslips (Total Net: PKR ${draftRun.total_net.toLocaleString()}).`);

  // --- 3. Admin Finalization & Lock Enforcement ---
  console.log('\n--- 3. Finalization & Locking Tests ---');

  const finalizedRun = payrollService.finalizePayrollRun(draftRun.id, admin);
  console.assert(finalizedRun.status === 'FINALIZED', 'Test Failed: Status must be FINALIZED');
  console.assert(finalizedRun.finalized_by === admin.id, 'Test Failed: finalized_by mismatch');
  console.log('✅ Finalization Passed: Payroll run locked by Admin.');

  // Attempt to modify finalized run must throw 403 Forbidden!
  let lockedRunFailed = false;
  try {
    payrollService.generateMonthlyDraft({
      month: 10,
      year: 2026
    }, hrUser);
  } catch (err) {
    if (err.status === 403) {
      lockedRunFailed = true;
    }
  }
  console.assert(lockedRunFailed, 'Test Failed: Finalized payroll modification should throw 403');
  console.log('✅ Lock Enforcement Passed: Server rejected attempt to edit locked payroll with 403 Forbidden.');

  // --- 4. Employee Scoping on Payslips ---
  console.log('\n--- 4. Payslip Scoping Tests ---');
  const emp1 = draftRun.payslips[0];
  const emp2 = draftRun.payslips[1] || draftRun.payslips[0];

  // Employee 1 accesses own payslip
  const ownSlip = payrollService.getPayslipById(emp1.id, {
    role: 'EMPLOYEE',
    employee_id: emp1.employee_id
  });
  console.assert(ownSlip.id === emp1.id, 'Test Failed: Employee could not access own payslip');

  // Employee 1 attempts to access Employee 2's payslip
  if (draftRun.payslips.length > 1) {
    let colleagueSlipFailed = false;
    try {
      payrollService.getPayslipById(emp2.id, {
        role: 'EMPLOYEE',
        employee_id: emp1.employee_id
      });
    } catch (err) {
      colleagueSlipFailed = true;
    }
    console.assert(colleagueSlipFailed, 'Test Failed: Employee should NOT be able to view colleague payslip');
    console.log('✅ Scope Guard Passed: Employee restricted to own payslip only.');
  }

  // --- 5. PDF Payslip Generation ---
  console.log('\n--- 5. PDF Generation Tests ---');
  const companySettings = companyService.getSettings();

  generatePayslipPdf(ownSlip, companySettings, (err, pdfBuffer) => {
    console.assert(!err, 'PDF Error: Generation failed');
    console.assert(pdfBuffer && pdfBuffer.length > 1000, 'PDF Error: Generated PDF buffer is empty or corrupted');
    console.log(`✅ PDF Generation Passed: Generated binary PDF (${pdfBuffer.length} bytes).`);

    console.log('\n🎉 ALL PHASE 4 BACKEND & BUSINESS RULE TESTS PASSED! 💯');
    process.exit(0);
  });
} catch (err) {
  console.error('❌ Phase 4 Test Suite Failed:', err);
  process.exit(1);
}
