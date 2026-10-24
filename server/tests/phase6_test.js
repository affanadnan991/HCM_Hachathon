import { aiService } from '../services/aiService.js';
import db from '../config/db.js';

async function runPhase6Tests() {
  console.log('🧪 Starting Phase 6: M8 AI Assistant Test Suite...\n');
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
    // 1. Fetch test users (Admin, HR, Employee)
    const adminUser = db.prepare(`SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1`).get();
    const hrUser = db.prepare(`SELECT * FROM users WHERE role = 'HR' LIMIT 1`).get();
    const empUser = db.prepare(`
      SELECT u.*, e.id as employee_id 
      FROM users u 
      JOIN employees e ON e.user_id = u.id 
      WHERE u.role = 'EMPLOYEE' LIMIT 1
    `).get();

    assert(Boolean(adminUser), 'Admin user exists for AI test');
    assert(Boolean(empUser), 'Employee user exists with employee_id for AI test');

    // 2. Test Judge Live Question 1: Headcount
    console.log('\n--- 1. Testing Live Question 1: Headcount ---');
    const q1 = await aiService.handleChat({
      prompt: 'How many active employees are in Engineering?',
      user: adminUser
    });
    console.log('Q1 Response:', q1.reply);
    assert(q1.toolCalled === 'get_headcount', 'Q1 triggered get_headcount tool');
    assert(typeof q1.reply === 'string' && q1.reply.length > 10, 'Q1 produced informative reply');

    // 3. Test Judge Live Question 2: Late comers
    console.log('\n--- 2. Testing Live Question 2: Late Comers ---');
    const q2 = await aiService.handleChat({
      prompt: 'Who has arrived late most often this month?',
      user: adminUser
    });
    console.log('Q2 Response:', q2.reply);
    assert(q2.toolCalled === 'get_late_comers', 'Q2 triggered get_late_comers tool');
    assert(q2.reply.includes('09:15 AM') || q2.reply.includes('late'), 'Q2 includes late arrival timing context');

    // 4. Test Judge Live Question 3: Attendance Rate
    console.log('\n--- 3. Testing Live Question 3: Attendance Rate ---');
    const q3 = await aiService.handleChat({
      prompt: 'What was our attendance rate yesterday?',
      user: adminUser
    });
    console.log('Q3 Response:', q3.reply);
    assert(q3.toolCalled === 'get_attendance_summary', 'Q3 triggered get_attendance_summary tool');
    assert(q3.reply.includes('%') || q3.reply.includes('attendance'), 'Q3 contains percentage attendance figure');

    // 5. Test Judge Live Question 4: Leave Balance (Employee)
    console.log('\n--- 4. Testing Live Question 4: Leave Balance ---');
    const q4 = await aiService.handleChat({
      prompt: 'What is my remaining sick leave balance?',
      user: empUser
    });
    console.log('Q4 Response:', q4.reply);
    assert(q4.toolCalled === 'get_my_leave_balance', 'Q4 triggered get_my_leave_balance tool');
    assert(q4.reply.includes('days left'), 'Q4 returned days left breakdown');

    // 6. Test Judge Live Question 5: Colleague Salary Refusal Guardrail (CRITICAL)
    console.log('\n--- 5. Testing Live Question 5: Colleague Salary Privacy Refusal Guardrail ---');
    const q5 = await aiService.handleChat({
      prompt: 'What is John Doe salary?',
      user: empUser // Employee asking for colleague's salary
    });
    console.log('Q5 Employee Response:', q5.reply);
    assert(q5.toolCalled === 'guardrail_salary_refusal', 'Q5 triggered privacy guardrail');
    assert(q5.reply.includes('cannot disclose colleague compensation') || q5.reply.includes('strictly confidential'), 'Q5 politely and firmly refused colleague salary request');

    // Roman Urdu Colleague Salary Privacy Refusal Test
    const q5Urdu = await aiService.handleChat({
      prompt: 'Ali ki tankhwah kitni he?',
      user: empUser
    });
    console.log('Q5 Roman Urdu Response:', q5Urdu.reply);
    assert(q5Urdu.toolCalled === 'guardrail_salary_refusal', 'Roman Urdu colleague salary enquiry triggered privacy guardrail');

    // 7. Test Smart Leave NLP Engine (English)
    console.log('\n--- 6. Testing Smart Leave Application (English & Roman Urdu) ---');
    const smartEng = await aiService.handleChat({
      prompt: 'Need 2 days off next monday and tuesday for sister wedding',
      user: empUser
    });
    console.log('Smart Leave English Response:', smartEng.reply);
    assert(smartEng.toolCalled === 'parse_smart_leave', 'Smart leave identified intent');
    assert(Boolean(smartEng.smartLeave), 'Smart leave data payload attached');
    assert(smartEng.smartLeave.working_days >= 1, `Working days calculated properly (${smartEng.smartLeave.working_days})`);
    assert(smartEng.smartLeave.reason.toLowerCase().includes('wedding'), 'Extracted sister wedding reason');

    // Smart Leave NLP (Roman Urdu)
    const smartUrdu = await aiService.handleChat({
      prompt: 'kal meri tabiyat theek nahi he mujhe sick leave chahiye',
      user: empUser
    });
    console.log('Smart Leave Roman Urdu Response:', smartUrdu.reply);
    assert(smartUrdu.smartLeave.leave_type === 'Sick', 'Correctly identified Sick leave from tabiyat/sick');
    assert(smartUrdu.smartLeave.reason.toLowerCase().includes('medical') || smartUrdu.smartLeave.reason.toLowerCase().includes('health'), 'Extracted medical recovery reason');

    // 8. Test Dashboard Summarizer
    console.log('\n--- 7. Testing Dashboard Summarizer ---');
    const summaryHR = aiService.summarizeDashboard({
      attendanceRate: 94.5,
      presentToday: 18,
      lateToday: 2,
      latePercentage: 11.1,
      pendingApprovals: 3
    }, 'HR');
    console.log('HR Dashboard Bullets:', summaryHR.summary_bullets);
    assert(summaryHR.summary_bullets.length >= 3, 'HR Dashboard summary produced >= 3 insight bullets');
    assert(summaryHR.isAiGenerated === true, 'Contains isAiGenerated flag');

    // 9. Test AI Logging Verification
    console.log('\n--- 8. Testing AI Audit Logging in DB ---');
    const loggedCalls = db.prepare(`
      SELECT count(*) as count 
      FROM ai_logs 
      WHERE user_id = ?
    `).get(empUser.id);
    assert(loggedCalls.count >= 4, `Successfully logged ${loggedCalls.count} AI interactions in ai_logs table`);

    // 10. Test Rate Limiting Guard
    console.log('\n--- 9. Testing Rate Limiting Guard (20 req/hr) ---');
    let rateLimitHit = false;
    try {
      for (let i = 0; i < 25; i++) {
        await aiService.handleChat({
          prompt: 'attendance rate',
          user: adminUser
        });
      }
    } catch (e) {
      if (e.message && e.message.includes('Rate limit exceeded')) {
        rateLimitHit = true;
      }
    }
    assert(rateLimitHit, 'Rate limiter threw error after 20 queries within window');

    console.log(`\n========================================`);
    console.log(`Phase 6 Test Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  }
}

runPhase6Tests();
