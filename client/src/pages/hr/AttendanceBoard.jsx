import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Clock, Calendar, Users, CheckCircle2, AlertTriangle, 
  XCircle, RotateCcw, Check, X, Filter, Search
} from 'lucide-react';

export default function AttendanceBoard() {
  const [boardDate, setBoardDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [boardData, setBoardData] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [activeTab, setActiveTab] = useState('board'); // 'board' or 'corrections'
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Review Correction modal
  const [reviewModal, setReviewModal] = useState({ open: false, correction: null, status: 'APPROVED', comment: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [boardRes, deptsRes, correctionsRes] = await Promise.all([
        api.get(`/attendance/daily-board?date=${boardDate}&department_id=${selectedDept}`),
        api.get('/company/departments'),
        api.get('/attendance/corrections?status=PENDING')
      ]);
      setBoardData(boardRes);
      setDepartments(deptsRes);
      setCorrections(correctionsRes);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [boardDate, selectedDept]);

  const handleReviewCorrection = async () => {
    try {
      await api.post(`/attendance/corrections/${reviewModal.correction.id}/review`, {
        status: reviewModal.status,
        reviewComment: reviewModal.comment
      });
      setMsg({ text: `Correction request marked as ${reviewModal.status}!`, type: 'success' });
      setReviewModal({ open: false, correction: null, status: 'APPROVED', comment: '' });
      loadData();
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

      {/* Top Tab Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${activeTab === 'board' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('board')}
          >
            <Clock size={16} /> Daily Attendance Board
          </button>
          <button
            className={`btn ${activeTab === 'corrections' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('corrections')}
          >
            <RotateCcw size={16} /> Pending Corrections ({corrections.length})
          </button>
        </div>

        {activeTab === 'board' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: '160px' }}
              value={boardDate}
              onChange={e => setBoardDate(e.target.value)}
            />
            <select
              className="form-select"
              style={{ width: '180px' }}
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'board' && boardData && (
        <>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="kpi-card">
              <div className="kpi-title">Total Roster</div>
              <div className="kpi-value">{boardData.summary.total}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Present</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{boardData.summary.present}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Late Comers</div>
              <div className="kpi-value" style={{ color: 'var(--warning)' }}>{boardData.summary.late}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Half Day</div>
              <div className="kpi-value" style={{ color: '#c084fc' }}>{boardData.summary.half_day}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">On Approved Leave</div>
              <div className="kpi-value" style={{ color: 'var(--secondary)' }}>{boardData.summary.on_leave}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Absent</div>
              <div className="kpi-value" style={{ color: 'var(--danger)' }}>{boardData.summary.absent}</div>
            </div>
          </div>

          {/* Roster Table */}
          <div className="glass-card">
            <h4 style={{ marginBottom: '1rem' }}>Employee Attendance Roster ({boardDate})</h4>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Employee Name</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Work Hours</th>
                    <th>Status</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {boardData.board.map((emp, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-employee">{emp.employee_code}</span></td>
                      <td style={{ fontWeight: '600' }}>{emp.first_name} {emp.last_name}</td>
                      <td>{emp.check_in_time ? new Date(emp.check_in_time).toLocaleTimeString() : '-'}</td>
                      <td>{emp.check_out_time ? new Date(emp.check_out_time).toLocaleTimeString() : '-'}</td>
                      <td>{emp.work_hours > 0 ? `${emp.work_hours} h` : '-'}</td>
                      <td>
                        <span className={`badge ${
                          emp.status === 'present' ? 'badge-success' :
                          emp.status === 'late' ? 'badge-warning' :
                          emp.status === 'half_day' ? 'badge-admin' :
                          emp.status === 'on_leave' ? 'badge-hr' : 'badge-danger'
                        }`}>
                          {emp.status}
                          {emp.isOnLeave && ` (${emp.leaveDetails})`}
                          {emp.holidayName && ` (${emp.holidayName})`}
                        </span>
                        {emp.is_corrected === 1 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', marginLeft: '0.4rem' }}>
                            (Corrected)
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          {emp.source || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Corrections Tab */}
      {activeTab === 'corrections' && (
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem' }}>Pending Attendance Corrections ({corrections.length})</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Employees submit correction requests when punches are missed. Review requested timestamps and reasons below.
          </p>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Original Punch</th>
                  <th>Requested Check-In</th>
                  <th>Requested Check-Out</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No pending correction requests.
                    </td>
                  </tr>
                ) : (
                  corrections.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{c.first_name} {c.last_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.employee_code} • {c.department_name}</div>
                      </td>
                      <td>
                        {c.original_check_in ? new Date(c.original_check_in).toLocaleTimeString() : 'No Check-In'} -{' '}
                        {c.original_check_out ? new Date(c.original_check_out).toLocaleTimeString() : 'No Check-Out'}
                      </td>
                      <td style={{ color: 'var(--primary)', fontWeight: '600' }}>
                        {new Date(c.requested_check_in).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--primary)', fontWeight: '600' }}>
                        {new Date(c.requested_check_out).toLocaleString()}
                      </td>
                      <td style={{ maxWidth: '200px' }}>{c.reason}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setReviewModal({ open: true, correction: c, status: 'APPROVED', comment: 'Approved' })}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setReviewModal({ open: true, correction: c, status: 'REJECTED', comment: '' })}
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', background: 'var(--surface-solid)' }}>
            <h4 style={{ marginBottom: '1rem' }}>
              {reviewModal.status === 'APPROVED' ? 'Approve' : 'Reject'} Correction Request
            </h4>
            <div className="form-group">
              <label className="form-label">Review Comment (Optional)</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="Reason or verification note..."
                value={reviewModal.comment}
                onChange={e => setReviewModal({ ...reviewModal, comment: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReviewModal({ open: false, correction: null, status: 'APPROVED', comment: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${reviewModal.status === 'APPROVED' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleReviewCorrection}
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
