import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Receipt, Play, Lock, CheckCircle2, AlertTriangle, 
  Download, Eye, FileText, DollarSign, Users, AlertCircle 
} from 'lucide-react';

export default function MonthlyPayroll() {
  const { user } = useAuth();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Selected Payslip for preview
  const [previewSlip, setPreviewSlip] = useState(null);

  const loadPayrollRuns = async () => {
    try {
      setLoading(true);
      const list = await api.get('/payroll/runs');
      setRuns(list);

      // Find run for currently selected month/year
      const matched = list.find(r => r.month === Number(selectedMonth) && r.year === Number(selectedYear));
      if (matched) {
        const fullRun = await api.get(`/payroll/runs/${matched.id}`);
        setActiveRun(fullRun);
      } else {
        setActiveRun(null);
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollRuns();
  }, [selectedMonth, selectedYear]);

  const handleGenerateDraft = async () => {
    setGenerating(true);
    setMsg({ text: '', type: '' });
    try {
      const run = await api.post('/payroll/runs/draft', {
        month: selectedMonth,
        year: selectedYear
      });
      setActiveRun(run);
      setMsg({ text: `Monthly payroll draft for ${selectedMonth}/${selectedYear} created!`, type: 'success' });
      loadPayrollRuns();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalizeRun = async () => {
    if (!activeRun) return;
    if (!confirm('Are you sure you want to finalize this payroll run? Once finalized, it will be locked and cannot be edited or recalculated.')) return;

    setFinalizing(true);
    try {
      const res = await api.post(`/payroll/runs/${activeRun.id}/finalize`);
      setActiveRun(res);
      setMsg({ text: 'Payroll finalized and locked successfully! Notifications sent to employees.', type: 'success' });
      loadPayrollRuns();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setFinalizing(false);
    }
  };

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div>
      {/* Alert Banner */}
      {msg.text && (
        <div style={{
          padding: '0.875rem 1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: msg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${msg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          color: msg.type === 'error' ? '#f87171' : '#34d399'
        }}>
          {msg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Header & Month Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Receipt size={22} style={{ color: 'var(--primary)' }} /> Monthly Payroll Management
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Review automatic salary calculations, deductions, income tax slabs, and finalize payslips.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: '140px' }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
          >
            {monthNames.map((name, i) => i > 0 && (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>

          <select
            className="form-select"
            style={{ width: '100px' }}
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {(!activeRun || activeRun.status !== 'FINALIZED') && (
            <button
              className="btn btn-primary"
              onClick={handleGenerateDraft}
              disabled={generating}
            >
              <Play size={16} /> {generating ? 'Computing...' : (activeRun ? 'Recalculate Draft' : 'Run Payroll Draft')}
            </button>
          )}

          {activeRun && activeRun.status === 'DRAFT' && user.role === 'ADMIN' && (
            <button
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              onClick={handleFinalizeRun}
              disabled={finalizing}
            >
              <Lock size={16} /> {finalizing ? 'Locking...' : 'Finalize & Lock Payroll'}
            </button>
          )}
        </div>
      </div>

      {activeRun ? (
        <>
          {/* Run Header Status Banner */}
          <div className="glass-card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className={`badge ${activeRun.status === 'FINALIZED' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                {activeRun.status === 'FINALIZED' ? '🔒 FINALIZED & LOCKED' : '📝 DRAFT IN REVIEW'}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Period: <strong>{monthNames[activeRun.month]} {activeRun.year}</strong> • {activeRun.total_employees} Employees Processed
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {activeRun.status === 'FINALIZED' ? `Locked by Admin on ${new Date(activeRun.finalized_at).toLocaleDateString()}` : 'Awaiting Admin finalization'}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="kpi-card">
              <div className="kpi-title">Gross Payroll Cost</div>
              <div className="kpi-value">PKR {Number(activeRun.total_gross || 0).toLocaleString()}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Total Deductions</div>
              <div className="kpi-value" style={{ color: 'var(--danger)' }}>PKR {Number(activeRun.total_deductions || 0).toLocaleString()}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Income Tax Deducted</div>
              <div className="kpi-value" style={{ color: 'var(--warning)' }}>PKR {Number(activeRun.total_tax || 0).toLocaleString()}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Net Salary Payout</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>PKR {Number(activeRun.total_net || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Payslips Table */}
          <div className="glass-card">
            <h4 style={{ marginBottom: '1rem' }}>Employee Payslips ({activeRun.payslips?.length || 0})</h4>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Employee Name</th>
                    <th>Gross Salary</th>
                    <th>Days Worked</th>
                    <th>Attendance Deductions</th>
                    <th>Income Tax</th>
                    <th>Net Salary</th>
                    <th>Payslip</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRun.payslips?.map(p => (
                    <tr key={p.id}>
                      <td><span className="badge badge-employee">{p.employee_code}</span></td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{p.first_name} {p.last_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.department_name}</div>
                      </td>
                      <td style={{ fontWeight: '600' }}>PKR {Number(p.gross_salary).toLocaleString()}</td>
                      <td>{p.days_worked} / {p.working_days_in_month} d</td>
                      <td style={{ color: 'var(--danger)' }}>
                        PKR {Number((p.unpaid_deduction || 0) + (p.half_day_deduction || 0)).toLocaleString()}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {p.absent_days} abs, {p.half_days} half
                        </div>
                      </td>
                      <td style={{ color: 'var(--warning)' }}>PKR {Number(p.tax_deduction).toLocaleString()}</td>
                      <td style={{ fontWeight: '800', color: 'var(--success)' }}>
                        PKR {Number(p.net_salary).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPreviewSlip(p)}
                            title="View Summary"
                          >
                            <Eye size={14} />
                          </button>
                          <a
                            href={`/api/payroll/payslips/${p.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary btn-sm"
                            title="Download PDF"
                          >
                            <Download size={14} /> PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <Receipt size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3>No Payroll Run Found for {monthNames[selectedMonth]} {selectedYear}</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', margin: '0.5rem auto 1.5rem auto', fontSize: '0.9rem' }}>
            Click 'Run Payroll Draft' above to automatically compute working days, attendance deductions, tax slabs, and net salaries for all eligible employees.
          </p>
          <button className="btn btn-primary btn-lg" onClick={handleGenerateDraft} disabled={generating}>
            <Play size={18} /> {generating ? 'Computing...' : `Generate ${monthNames[selectedMonth]} ${selectedYear} Draft`}
          </button>
        </div>
      )}

      {/* Payslip Preview Modal */}
      {previewSlip && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '600px', width: '100%', background: 'var(--surface-solid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Payslip Summary</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {previewSlip.first_name} {previewSlip.last_name} ({previewSlip.employee_code}) • {monthNames[selectedMonth]} {selectedYear}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreviewSlip(null)}>✕</button>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>Basic Salary: <strong>PKR {Number(previewSlip.basic_salary).toLocaleString()}</strong></div>
                <div>HRA (40%): <strong>PKR {Number(previewSlip.hra_allowance).toLocaleString()}</strong></div>
                <div>Medical (10%): <strong>PKR {Number(previewSlip.medical_allowance).toLocaleString()}</strong></div>
                <div>Gross (1.5x): <strong style={{ color: 'var(--primary)' }}>PKR {Number(previewSlip.gross_salary).toLocaleString()}</strong></div>
              </div>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>Days Worked: <strong>{previewSlip.days_worked} / {previewSlip.working_days_in_month}</strong></div>
                <div>Absent Days: <strong style={{ color: 'var(--danger)' }}>{previewSlip.absent_days}</strong></div>
                <div>Attendance Deductions: <strong style={{ color: 'var(--danger)' }}>PKR {Number((previewSlip.unpaid_deduction || 0) + (previewSlip.half_day_deduction || 0)).toLocaleString()}</strong></div>
                <div>Income Tax Deduction: <strong style={{ color: 'var(--warning)' }}>PKR {Number(previewSlip.tax_deduction).toLocaleString()}</strong></div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700' }}>NET TAKE-HOME PAY:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--success)' }}>
                  PKR {Number(previewSlip.net_salary).toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setPreviewSlip(null)}>Close</button>
              <a href={`/api/payroll/payslips/${previewSlip.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-primary">
                <Download size={16} /> Download PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
