import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Users, UserPlus, KeyRound, ShieldAlert, CheckCircle2, AlertCircle, Power } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Create HR Form
  const [hrForm, setHrForm] = useState({ email: '', password: '' });
  const [creatingHr, setCreatingHr] = useState(false);

  // Reset Password Modal
  const [resetModal, setResetModal] = useState({ open: false, user: null, tempPassword: '' });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/users');
      setUsers(res);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateHr = async (e) => {
    e.preventDefault();
    setCreatingHr(true);
    try {
      await api.post('/auth/create-hr', hrForm);
      setHrForm({ email: '', password: '' });
      setMsg({ text: 'HR account created successfully!', type: 'success' });
      loadUsers();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setCreatingHr(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await api.post('/auth/toggle-status', {
        targetUserId: user.id,
        isActive: !user.is_active
      });
      setMsg({ text: `User ${user.is_active ? 'deactivated' : 'activated'} successfully.`, type: 'success' });
      loadUsers();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/reset-password', {
        targetUserId: resetModal.user.id,
        tempPassword: resetModal.tempPassword
      });
      setMsg({ text: `Password reset for ${resetModal.user.email}. Forced change enabled.`, type: 'success' });
      setResetModal({ open: false, user: null, tempPassword: '' });
      loadUsers();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
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
          {msg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{msg.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Create HR Form */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} style={{ color: 'var(--primary)' }} /> Create HR Login
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Admin can provision HR accounts for daily people operations, employee management, and payroll drafting.
          </p>

          <form onSubmit={handleCreateHr}>
            <div className="form-group">
              <label className="form-label">HR Email Address *</label>
              <input
                type="email"
                className="form-input"
                placeholder="hr@company.com"
                value={hrForm.email}
                onChange={e => setHrForm({ ...hrForm, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Initial Password *</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={hrForm.password}
                onChange={e => setHrForm({ ...hrForm, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} disabled={creatingHr}>
              {creatingHr ? 'Creating HR Account...' : 'Provision HR Account'}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} style={{ color: 'var(--primary)' }} /> System Accounts ({users.length})
          </h3>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>User / Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>First Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{u.email}</div>
                      {u.first_name && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {u.first_name} {u.last_name} ({u.employee_code})
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        u.role === 'ADMIN' ? 'badge-admin' : u.role === 'HR' ? 'badge-hr' : 'badge-employee'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      {u.must_change_password ? (
                        <span className="badge badge-warning">Needs Change</span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setResetModal({ open: true, user: u, tempPassword: '' })}
                          title="Reset Password"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          className={`btn ${u.is_active ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                          onClick={() => handleToggleStatus(u)}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetModal.open && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '420px', width: '100%', background: 'var(--surface-solid)' }}>
            <h4 style={{ marginBottom: '1rem' }}>Reset Password for {resetModal.user?.email}</h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Setting a temporary password will force the user to change their password on next sign-in.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">Temporary Password *</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={resetModal.tempPassword}
                  onChange={e => setResetModal({ ...resetModal, tempPassword: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResetModal({ open: false, user: null, tempPassword: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Force Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
