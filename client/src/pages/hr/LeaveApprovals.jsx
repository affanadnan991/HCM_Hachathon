import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { CalendarDays, CheckCircle2, AlertTriangle, Check, X, Filter, Users } from 'lucide-react';

export default function LeaveApprovals() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Review Modal State
  const [reviewModal, setReviewModal] = useState({ open: false, request: null, status: 'APPROVED', comment: '' });

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/leave?status=${statusFilter}`);
      setRequests(res);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const handleReviewSubmit = async () => {
    try {
      await api.post(`/leave/${reviewModal.request.id}/review`, {
        status: reviewModal.status,
        reviewComment: reviewModal.comment
      });
      setMsg({
        text: `Leave request for ${reviewModal.request.first_name} ${reviewModal.request.last_name} marked as ${reviewModal.status}!`,
        type: 'success'
      });
      setReviewModal({ open: false, request: null, status: 'APPROVED', comment: '' });
      loadRequests();
    } catch (err) {
      alert(err.message);
    }
  };

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
          {msg.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Top Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarDays size={20} style={{ color: 'var(--primary)' }} /> Leave Requests Inbox
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Approve or reject employee leave applications with justification comments.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(st => (
            <button
              key={st}
              className={`btn ${statusFilter === (st === 'ALL' ? '' : st) ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(st === 'ALL' ? '' : st)}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="glass-card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Duration & Dates</th>
                <th>Working Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No {statusFilter.toLowerCase()} leave requests found.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{req.first_name} {req.last_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {req.employee_code} • {req.department_name}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-hr">{req.leave_type_name}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{req.start_date} to {req.end_date}</div>
                    </td>
                    <td>
                      <span className="badge badge-employee" style={{ fontSize: '0.85rem' }}>
                        {req.working_days_count} days
                      </span>
                    </td>
                    <td style={{ maxWidth: '220px', fontSize: '0.85rem' }}>{req.reason}</td>
                    <td>
                      <span className={`badge ${
                        req.status === 'APPROVED' ? 'badge-success' :
                        req.status === 'PENDING' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      {req.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setReviewModal({ open: true, request: req, status: 'APPROVED', comment: 'Approved' })}
                            title="Approve"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setReviewModal({ open: true, request: req, status: 'REJECTED', comment: '' })}
                            title="Reject"
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', background: 'var(--surface-solid)' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>
              {reviewModal.status === 'APPROVED' ? 'Approve' : 'Reject'} Leave Application
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Applicant: <strong>{reviewModal.request?.first_name} {reviewModal.request?.last_name}</strong> ({reviewModal.request?.leave_type_name} Leave for {reviewModal.request?.working_days_count} working days).
            </p>

            <div className="form-group">
              <label className="form-label">Manager Review Note (Optional)</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="Approval or rejection remarks..."
                value={reviewModal.comment}
                onChange={e => setReviewModal({ ...reviewModal, comment: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReviewModal({ open: false, request: null, status: 'APPROVED', comment: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${reviewModal.status === 'APPROVED' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleReviewSubmit}
              >
                Confirm {reviewModal.status}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
