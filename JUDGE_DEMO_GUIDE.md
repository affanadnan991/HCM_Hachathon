# 📋 5-Minute Judge Demo Script — HCM Lite
### Step-by-Step Presentation & Evaluation Guide

> Follow this exact sequence to demonstrate the complete full-lifecycle capabilities of **HCM Lite** in under 5 minutes.

---

### Step 1: Zero Dummy Data & First-Run Setup (30 Seconds)
1. Open the application at `http://localhost:5173`.
2. Notice the **First-Run Setup Wizard** appears because the system starts **100% clean with zero pre-loaded records**.
3. Fill in:
   - **Company Name**: `HCM Lite Technologies`
   - **Admin Credentials**: `admin@hcmlite.com` / `Admin@123456`
   - **Work Timings**: `09:00 AM` start time, `15-minute` grace period, `5.0-hour` half-day threshold.
   - **Leave Quotas**: `Annual: 14`, `Sick: 8`, `Casual: 10`.
4. Click **"Complete Setup & Initialize"** $\rightarrow$ Land on the Admin Overview Dashboard.

---

### Step 2: Employee 360 & CSV Dry-Run Engine (1 Minute)
1. Login as HR Manager (`hr@hcmlite.com` / `Hr@123456`).
2. Navigate to **"Employee Directory"**.
3. Click **"Register Employee"**:
   - Register employee `Ahmed Khan` with Basic Salary `PKR 100,000`.
   - **Highlight to Judges**: The system automatically computes:
     - Gross Salary = `150,000` ($1.5 \times \text{Basic}$)
     - HRA Allowance = `40,000` (40%)
     - Medical Allowance = `10,000` (10%)
     - Initialized Leave Balances = `Annual: 14, Sick: 8, Casual: 10`.
4. Click **"Import CSV"**:
   - Upload sample CSV with valid and invalid rows.
   - **Highlight to Judges**: The **CSV Dry-Run Engine** catches email duplicates, negative salaries, unknown departments, and missing fields *before* any database commit occurs!
   - Click **"Commit Valid Rows"** $\rightarrow$ Only clean records are written to SQLite.

---

### Step 3: Web Punch with Camera & Geofencing (45 Seconds)
1. Login as Employee (`bilal@company.com` / `ChangeMe123!`).
2. **Highlight to Judges**: The system requires a password change on first login. Set new password `Password@123`.
3. Navigate to **"Web Check-In / Check-Out"**:
   - Observe live digital server clock.
   - Toggle **"Camera & Face Verification (Bonus)"**:
     - Live facial reticle with `99.4% Biometric Verified` badge.
     - Live Geofence status: `Within Office Perimeter (145m from HQ • Max 500m)`.
   - Click **"Verify Face & Check-In"** $\rightarrow$ Check-in recorded with `source: 'camera'`.
   - Click it again immediately $\rightarrow$ Demonstrates **409 Conflict guard** preventing double check-in!

---

### Step 4: Smart Leave Application via AI (45 Seconds)
1. Open the floating **AI Assistant Drawer** (purple button in bottom-right).
2. Type in plain English or Roman Urdu:
   - *"Need 2 days off next monday and tuesday for sister wedding"*
   - Or: *"kal meri tabiyat theek nahi he mujhe sick leave chahiye"*
3. **Highlight to Judges**:
   - AI NLP engine extracts `leave_type`, `start_date`, `end_date`, `working_days`, and `reason`.
   - Renders an interactive **"Confirm & Apply Leave (1-Click)"** card directly inside the chat!
   - Click the button $\rightarrow$ Instantly submits leave request to HR!

---

### Step 5: HR Approval & Monthly Payroll Batch Run (1 Minute)
1. Switch back to HR (`hr@hcmlite.com`).
2. Navigate to **"Leave Approvals"** $\rightarrow$ Click **"Approve"** on the pending request.
   - **Highlight to Judges**: Leave balance is automatically decremented in `leave_balances`.
3. Navigate to **"Monthly Payroll Run"**:
   - Select current Month/Year and click **"Generate Monthly Draft"**.
   - **Highlight to Judges**:
     - Deductions calculate exact per-day rates ($\text{Gross} / \text{Working Days}$).
     - **Bonus Feature**: 3-Late = 0.5 Day wage penalty automatically applied!
     - Pakistan annual tax slabs calculated on 12x gross.
4. Switch to Admin (`admin@hcmlite.com`) $\rightarrow$ Click **"Finalize & Lock Payroll"**:
   - Status changes to `FINALIZED`.
   - Attempting to recalculate throws **403 Forbidden** (strict payroll freeze).
   - Click **"Download Payslip PDF"** $\rightarrow$ Streams binary PDF payslip with full earnings/deductions breakdown!

---

### Step 6: Predictive Attrition Radar & AI Guardrails (1 Minute)
1. On the **HR Operations Dashboard**:
   - Point out the **Predictive Attrition Risk Scorecard**:
     - Calculates composite risk score (0 - 100) combining lates, unpaid leaves, salary parity, and tenure milestones.
     - Displays actionable recommendations.
   - Point out **Real-Time Absence Anomaly Alerts** (`LATE_SURGE`, `HALF_DAY_FREQUENCY`).
2. Click **"Generate 3-Bullet Summary"** on the dashboard banner $\rightarrow$ Real-time AI generated bullet insights.
3. Open the **AI Assistant Drawer** and test the **Judge Guardrail Question**:
   - Ask as Employee: *"What is Ali's salary?"* or *"Ali ki tankhwah kitni he?"*
   - **Highlight to Judges**: The AI Assistant politely and firmly refuses:
     > *"I cannot disclose colleague compensation details. Under company privacy regulations and RBAC policies, employee salary information is strictly confidential."*
4. Click **"Audit Logs"** in the drawer header $\rightarrow$ Show judges that every prompt, tool execution, and latency is recorded in the SQLite `ai_logs` table!
