import db from '../config/db.js';
import { payrollService } from '../services/payrollService.js';
import { analyticsService } from '../services/analyticsService.js';
import { generatePayslipPdf } from '../utils/pdfGenerator.js';
import { PassThrough } from 'stream';

async function runPhase7Tests() {
  console.log('🧪 Starting Phase 7: Bonus Features Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    const adminUser = db.prepare(`SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1`).get();
    const hrUser = db.prepare(`SELECT * FROM users WHERE role = 'HR' LIMIT 1`).get();
    const emp = db.prepare(`SELECT * FROM employees LIMIT 1`).get();

    assert(Boolean(emp), 'Employee exists in database for testing');

    // --- 1. Test 3-Late = 0.5 Day Wage Penalty in Payroll ---
    console.log('\n--- 1. Testing Automatic 3-Late Wage Penalty Rule ---');
    const testMonth = 11;
    const testYear = 2026;

    // Delete any existing run for test month to ensure clean state
    db.prepare(`DELETE FROM payroll_runs WHERE month = ? AND year = ?`).run(testMonth, testYear);

    // Seed 3 late arrivals for this employee in test month
    db.prepare(`DELETE FROM attendance WHERE employee_id = ? AND date LIKE ?`).run(emp.id, `${testYear}-11-%`);
    db.prepare(`
      INSERT INTO attendance (employee_id, date, check_in_time, check_out_time, work_hours, status, source)
      VALUES (?, '2026-11-02 09:30:00', '2026-11-02 09:30:00', '2026-11-02 18:00:00', 8.5, 'late', 'web'),
             (?, '2026-11-03 09:45:00', '2026-11-03 09:45:00', '2026-11-03 18:00:00', 8.25, 'late', 'web'),
             (?, '2026-11-04 09:20:00', '2026-11-04 09:20:00', '2026-11-04 18:00:00', 8.6, 'late', 'camera')
    `).run(emp.id, emp.id, emp.id);

    // Run Draft Payroll
    const draftRun = payrollService.generateMonthlyDraft({
      month: testMonth,
      year: testYear
    }, hrUser || adminUser);

    assert(Boolean(draftRun), 'Payroll run draft created successfully');
    const empPayslip = draftRun.payslips.find(p => p.employee_id === emp.id);
    assert(Boolean(empPayslip), 'Employee payslip found in payroll run');

    console.log(`  Late count: ${empPayslip.late_count}, Late penalty deduction: PKR ${empPayslip.late_penalty_deduction}`);
    assert(empPayslip.late_count >= 3, 'Late arrivals counted correctly (>= 3)');
    assert(empPayslip.late_penalty_deduction > 0, 'Late penalty deduction calculated (> 0)');

    // Verify per-day calculation: Math.floor(3/3) * 0.5 * perDayRate
    const expectedPerDay = empPayslip.gross_salary / empPayslip.working_days_in_month;
    const expectedLatePenalty = Number((1 * 0.5 * expectedPerDay).toFixed(2));
    assert(Math.abs(empPayslip.late_penalty_deduction - expectedLatePenalty) < 0.05, `Late penalty equals exactly 0.5 day rate (Expected: ${expectedLatePenalty}, Got: ${empPayslip.late_penalty_deduction})`);

    // --- 2. Test PDF Payslip with Late Penalty Breakdown ---
    console.log('\n--- 2. Testing PDF Payslip Generation with Late Penalty ---');
    const pdfBuffer = await new Promise((resolve, reject) => {
      generatePayslipPdf(empPayslip, { company_name: 'HCM Lite' }, (err, buf) => {
        if (err) reject(err);
        else resolve(buf);
      });
    });

    console.log(`  Generated PDF payslip byte size: ${pdfBuffer.length} bytes`);
    assert(pdfBuffer.length > 2000, 'PDF payslip generated successfully with binary stream > 2KB');

    // --- 3. Test Predictive Attrition Risk Engine ---
    console.log('\n--- 3. Testing Predictive Attrition Risk Analysis ---');
    const riskAnalysis = analyticsService.getAttritionRiskAnalysis();
    assert(Array.isArray(riskAnalysis) && riskAnalysis.length > 0, 'Attrition risk analysis returned employee array');

    const firstRisk = riskAnalysis[0];
    console.log('Sample Attrition Risk Profile:', {
      name: firstRisk.name,
      score: firstRisk.riskScore,
      level: firstRisk.riskLevel,
      recommendation: firstRisk.actionRecommendation
    });

    assert(typeof firstRisk.riskScore === 'number' && firstRisk.riskScore >= 0 && firstRisk.riskScore <= 100, 'Risk score is within 0-100 range');
    assert(['LOW', 'MODERATE', 'HIGH'].includes(firstRisk.riskLevel), 'Risk level is valid enum');
    assert(typeof firstRisk.actionRecommendation === 'string', 'Contains actionable retention recommendation');

    // --- 4. Test Absence Anomaly Detection ---
    console.log('\n--- 4. Testing Real-Time Absence Anomaly Detection ---');
    const anomalies = analyticsService.getAbsenceAnomalies();
    assert(Array.isArray(anomalies), 'Absence anomalies returned an array');
    console.log(`  Detected ${anomalies.length} anomaly alerts in current cycle`);

    // Clean up test run
    db.prepare(`DELETE FROM payroll_runs WHERE month = ? AND year = ?`).run(testMonth, testYear);

    console.log(`\n========================================`);
    console.log(`Phase 7 Test Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  }
}

runPhase7Tests();
