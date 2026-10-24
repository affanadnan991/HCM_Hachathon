import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, Plus, Trash2, AlertCircle, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'NORMAL'
  });

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const list = await api.get('/comms/announcements');
      setAnnouncements(list);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/comms/announcements', form);
      setMsg({ text: 'Announcement published successfully!', type: 'success' });
      setShowModal(false);
      setForm({ title: '', content: '', priority: 'NORMAL' });
      loadAnnouncements();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      await api.delete(`/comms/announcements/${id}`);
      setMsg({ text: 'Announcement removed.', type: 'success' });
      loadAnnouncements();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const canPost = user.role === 'ADMIN' || user.role === 'HR';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Megaphone size={22} style={{ color: 'var(--primary)' }} /> Company Notice Board
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Broadcast company-wide news, holiday reminders, and policy updates.
          </span>
        </div>

        {canPost && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Post Announcement
          </button>
        )}
      </div>

      {/* Announcements Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {announcements.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No company announcements posted yet.
          </div>
        ) : (
          announcements.map(ann => (
            <div
              key={ann.id}
              className="glass-card"
              style={{
                borderLeft: ann.priority === 'URGENT' ? '4px solid var(--danger)' : '4px solid var(--primary)',
                background: ann.priority === 'URGENT' ? 'rgba(239, 68, 68, 0.05)' : undefined
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{ann.title}</h4>
                  <span className={`badge ${ann.priority === 'URGENT' ? 'badge-danger' : 'badge-employee'}`}>
                    {ann.priority}
                  </span>
                </div>

                {canPost && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(ann.id)}
                    title="Delete notice"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0.5rem 0 1rem 0' }}>
                {ann.content}
              </p>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                Posted by <strong>{ann.author_email}</strong> ({ann.author_role}) on {new Date(ann.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Post Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '540px', width: '100%', background: 'var(--surface-solid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0 }}>Create New Announcement</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label className="form-label">Notice Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Office Relocation or Eid Holidays"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Priority Level *</label>
                <select
                  className="form-select"
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="NORMAL">Normal Notice</option>
                  <option value="URGENT">Urgent Broadcast (High Priority)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Announcement Content *</label>
                <textarea
                  className="form-textarea"
                  rows="4"
                  placeholder="Write message details for the company..."
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
