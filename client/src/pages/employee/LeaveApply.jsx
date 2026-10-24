import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  CalendarDays, Send, AlertCircle, CheckCircle2, 
  History, Clock, X, Info, Sparkles 
} from 'lucide-react';

export default function LeaveApply() {
  const { user } = useAuth();
  const [balances, setBalances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Form State
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const loadLeaveData = async () => {
    try {
      setLoading(true);
      const [balRes, reqRes] = await Promise.all([
        api.get('/leave/balances'),
        api.get('/leave')
      ]);
      setBalances(balRes);
      setLeaveRequests(reqRes);
      if (balRes.length > 0 && !form.leaveTypeId) {
        setForm(prev => ({ ...prev, leaveTypeId: balRes[0].leave_type_id }));
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaveData();
  }, []);

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg({ text: '', type: '' });

    try {
      await api.post('/leave/apply', form);
      setMsg({ text: 'Leave request submitted successfully for HR approval!', type: 'success' });
      setForm({
        leaveTypeId: balances[0]?.leave_type_id || '',
        startDate: '',
        endDate: '',
        reason: ''
      });
      loadLeaveData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (id) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await api.post(`/leave/${id}/cancel`);
      setMsg({ text: 'Leave request cancelled.', type: 'success' });
      loadLeaveData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

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

      {/* Quota Balances Summary */}
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <CalendarDays size={20} style={{ color: 'var(--primary)' }} /> My Annual Leave Quotas
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {balances.map(b => (
          <div key={b.id} className="kpi-card">
            <div className="kpi-title">{b.leave_type_name} Leave</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span className="kpi-value" style={{ color: b.remaining_days > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                {b.total_quota > 1000 ? '∞' : b.remaining_days}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                / {b.total_quota > 1000 ? 'Unlimited' : `${b.total_quota} days`}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              {b.used_days} days utilized this year
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr', gap: '1.5rem' }}>
        {/* Leave Application Form */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Send size={18} style={{ color: 'var(--primary)' }} /> Apply for Leave
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Working days are calculated automatically. Weekends and gazetted public holidays will not deduct from your quota.
          </p>

          <form onSubmit={handleApplySubmit}>
            <div className="form-group">
              <label className="form-label">Leave Type *</label>
              <select
                className="form-select"
                value={form.leaveTypeId}
                onChange={e => setForm({ ...form, leaveTypeId: Number(e.target.value) })}
                required
              >
                {balances.map(b => (
                  <option key={b.id} value={b.leave_type_id}>
                    {b.leave_type_name} ({b.total_quota > 1000 ? 'Unlimited' : `${b.remaining_days} days left`})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.startDate}
                  onChange={e => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.endDate}
                  onChange={e => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reason for Absence *</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="Medical reason, family obligation, personal appointment..."
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={submitting}>
              {submitting ? 'Verifying & Submitting...' : 'Submit Leave Request'}
            </button>
          </form>
        </div>

        {/* Leave Requests History */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} style={{ color: 'var(--primary)' }} /> My Leave Applications ({leaveRequests.length})
          </h4>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No leave requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map(lr => (
                    <tr key={lr.id}>
                      <td style={{ fontWeight: '600' }}>{lr.leave_type_name}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{lr.start_date} to {lr.end_date}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lr.reason}</div>
                      </td>
                      <td><span className="badge badge-employee">{lr.working_days_count} d</span></td>
                      <td>
                        <span className={`badge ${
                          lr.status === 'APPROVED' ? 'badge-success' :
                          lr.status === 'PENDING' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {lr.status}
                        </span>
                      </td>
                      <td>
                        {lr.status === 'PENDING' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancelLeave(lr.id)}
                            title="Cancel Request"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
