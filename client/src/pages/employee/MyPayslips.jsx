import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Receipt, Download, FileText, CheckCircle2, AlertCircle, Eye, DollarSign, Calendar } from 'lucide-react';

export default function MyPayslips() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [previewSlip, setPreviewSlip] = useState(null);

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const loadMyPayslips = async () => {
    try {
      setLoading(true);
      const list = await api.get('/payroll/my-payslips');
      setPayslips(list);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyPayslips();
  }, []);

  return (
    <div style={{ maxWidth: '960px' }}>
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

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Receipt size={22} style={{ color: 'var(--primary)' }} /> My Monthly Payslips
        </h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          View finalized compensation breakdowns and download official PDF payslips.
        </span>
      </div>

      <div className="glass-card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Gross Salary</th>
                <th>Days Worked</th>
                <th>Deductions</th>
                <th>Net Take-Home Pay</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No finalized payslips available yet. Once payroll is locked by Admin, your payslip will appear here.
                  </td>
                </tr>
              ) : (
                payslips.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: '700' }}>{monthNames[p.month]} {p.year}</div>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Finalized</span>
                    </td>
                    <td style={{ fontWeight: '600' }}>PKR {Number(p.gross_salary).toLocaleString()}</td>
                    <td>{p.days_worked} / {p.working_days_in_month} days</td>
                    <td style={{ color: 'var(--danger)' }}>PKR {Number(p.total_deductions).toLocaleString()}</td>
                    <td style={{ fontWeight: '800', color: 'var(--success)', fontSize: '1rem' }}>
                      PKR {Number(p.net_salary).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setPreviewSlip(p)}
                        >
                          <Eye size={14} /> Summary
                        </button>
                        <a
                          href={`/api/payroll/payslips/${p.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary btn-sm"
                        >
                          <Download size={14} /> PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Modal */}
      {previewSlip && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '540px', width: '100%', background: 'var(--surface-solid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Payslip for {monthNames[previewSlip.month]} {previewSlip.year}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Official Compensation Document</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreviewSlip(null)}>✕</button>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
              <h5 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>EARNINGS BREAKDOWN</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div>Basic Salary: <strong>PKR {Number(previewSlip.basic_salary).toLocaleString()}</strong></div>
                <div>HRA Allowance (40%): <strong>PKR {Number(previewSlip.hra_allowance).toLocaleString()}</strong></div>
                <div>Medical Allowance (10%): <strong>PKR {Number(previewSlip.medical_allowance).toLocaleString()}</strong></div>
                <div>Gross Salary: <strong style={{ color: 'var(--primary)' }}>PKR {Number(previewSlip.gross_salary).toLocaleString()}</strong></div>
              </div>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <h5 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>DEDUCTIONS & TAX</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div>Attendance Deductions: <strong style={{ color: 'var(--danger)' }}>PKR {Number((previewSlip.unpaid_deduction || 0) + (previewSlip.half_day_deduction || 0)).toLocaleString()}</strong></div>
                <div>Income Tax (Slab): <strong style={{ color: 'var(--warning)' }}>PKR {Number(previewSlip.tax_deduction).toLocaleString()}</strong></div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700' }}>NET TAKE-HOME SALARY:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--success)' }}>
                  PKR {Number(previewSlip.net_salary).toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setPreviewSlip(null)}>Close</button>
              <a href={`/api/payroll/payslips/${previewSlip.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-primary">
                <Download size={16} /> Download Official PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
