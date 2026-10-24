import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User, Phone, MapPin, Building, Calendar, DollarSign, Save, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

export default function EmployeeProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Editable fields: only phone and address (strictly per business rules)
  const [editForm, setEditForm] = useState({ phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (user?.employee_id) {
        const data = await api.get(`/employees/${user.employee_id}`);
        setProfile(data);
        setEditForm({
          phone: data.phone || '',
          address: data.address || ''
        });
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/employees/${user.employee_id}`, editForm);
      setMsg({ text: 'Contact details updated successfully!', type: 'success' });
      loadProfile();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading employee profile...</div>;
  if (!profile) return <div>Employee profile not found.</div>;

  return (
    <div style={{ maxWidth: '850px' }}>
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

      {/* Header Profile Capsule */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: '800'
        }}>
          {profile.first_name[0]}
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>
            {profile.first_name} {profile.last_name}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-employee">{profile.employee_code}</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {profile.department_name} • {profile.designation_title || 'Staff Member'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Editable Contact Info (Allowed) */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Phone size={18} style={{ color: 'var(--primary)' }} /> Personal Contact Info
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Per company policy, employees are authorized to update their own phone and residential address.
          </p>

          <form onSubmit={handleSaveContact}>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="0300-1234567"
                value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Residential Address</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="Your home address..."
                value={editForm.address}
                onChange={e => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Update Contact Info'}
            </button>
          </form>
        </div>

        {/* Read-Only Compensation & Job Details */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} style={{ color: 'var(--success)' }} /> Employment & Compensation
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Work Email:</span>
              <div style={{ fontWeight: '600' }}>{profile.email}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Joining Date:</span>
              <div style={{ fontWeight: '600' }}>{profile.date_of_joining}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <div><span className="badge badge-success">{profile.employment_status}</span></div>
            </div>
            <div style={{
              background: 'var(--surface-hover)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>GROSS SALARY (CONFIDENTIAL)</span>
              <div style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1.2rem' }}>
                PKR {profile.gross_salary?.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
