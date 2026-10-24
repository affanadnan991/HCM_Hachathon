import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Building2, Clock, CalendarDays, Award, Plus, Trash2, 
  Save, AlertCircle, CheckCircle2, ShieldAlert
} from 'lucide-react';

export default function OrgSetup() {
  const [activeTab, setActiveTab] = useState('timing');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Data states
  const [settings, setSettings] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [desigForm, setDesigForm] = useState({ department_id: '', title: '' });
  const [holidayForm, setHolidayForm] = useState({ name: '', holiday_date: '' });

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [s, d, des, lt, h] = await Promise.all([
        api.get('/company/settings'),
        api.get('/company/departments'),
        api.get('/company/designations'),
        api.get('/company/leave-types'),
        api.get('/company/holidays')
      ]);
      setSettings(s);
      setDepartments(d);
      setDesignations(des);
      setLeaveTypes(lt);
      setHolidays(h);
      if (d.length > 0 && !desigForm.department_id) {
        setDesigForm(prev => ({ ...prev, department_id: d[0].id }));
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/company/settings', settings);
      setSettings(res);
      setMsg({ text: 'Settings updated successfully!', type: 'success' });
      setTimeout(() => setMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    try {
      await api.post('/company/departments', deptForm);
      setDeptForm({ name: '', code: '' });
      setMsg({ text: 'Department added successfully!', type: 'success' });
      loadAllData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleDeleteDept = async (id) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await api.delete(`/company/departments/${id}`);
      setMsg({ text: 'Department removed.', type: 'success' });
      loadAllData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleAddDesig = async (e) => {
    e.preventDefault();
    try {
      await api.post('/company/designations', desigForm);
      setDesigForm(prev => ({ ...prev, title: '' }));
      setMsg({ text: 'Designation created!', type: 'success' });
      loadAllData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleDeleteDesig = async (id) => {
    try {
      await api.delete(`/company/designations/${id}`);
      loadAllData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      await api.post('/company/holidays', holidayForm);
      setHolidayForm({ name: '', holiday_date: '' });
      setMsg({ text: 'Holiday added!', type: 'success' });
      loadAllData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      await api.delete(`/company/holidays/${id}`);
      loadAllData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  if (loading) return <div>Loading organization setup...</div>;

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

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        {[
          { id: 'timing', label: 'Office Timing & Geofence', icon: Clock },
          { id: 'depts', label: 'Departments', icon: Building2 },
          { id: 'desigs', label: 'Designations', icon: Award },
          { id: 'leaves', label: 'Leave Quotas', icon: CalendarDays },
          { id: 'holidays', label: 'Public Holidays', icon: CalendarDays }
        ].map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Office Timing & Geofence */}
      {activeTab === 'timing' && settings && (
        <div className="glass-card" style={{ maxWidth: '700px' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} style={{ color: 'var(--primary)' }} /> Work Rules & Geofence Settings
          </h3>
          <form onSubmit={handleUpdateSettings}>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.company_name}
                onChange={e => setSettings({ ...settings, company_name: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Office Start Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={settings.office_start_time}
                  onChange={e => setSettings({ ...settings, office_start_time: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Grace Period (Minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.grace_period_minutes}
                  onChange={e => setSettings({ ...settings, grace_period_minutes: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Half-Day Threshold (Hours)</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-input"
                  value={settings.half_day_hours}
                  onChange={e => setSettings({ ...settings, half_day_hours: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Geofence Radius (Meters)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.office_radius_meters}
                  onChange={e => setSettings({ ...settings, office_radius_meters: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Office Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-input"
                  value={settings.office_latitude || ''}
                  onChange={e => setSettings({ ...settings, office_latitude: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Office Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-input"
                  value={settings.office_longitude || ''}
                  onChange={e => setSettings({ ...settings, office_longitude: Number(e.target.value) })}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <Save size={16} /> Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Departments */}
      {activeTab === 'depts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.5rem' }}>
          <div className="glass-card">
            <h4 style={{ marginBottom: '1rem' }}>Add New Department</h4>
            <form onSubmit={handleAddDept}>
              <div className="form-group">
                <label className="form-label">Department Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Finance"
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Department Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. FIN"
                  value={deptForm.code}
                  onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Plus size={16} /> Add Department
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h4 style={{ marginBottom: '1rem' }}>Registered Departments ({departments.length})</h4>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Employees</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No departments registered.</td></tr>
                  ) : (
                    departments.map(d => (
                      <tr key={d.id}>
                        <td><span className="badge badge-employee">{d.code}</span></td>
                        <td style={{ fontWeight: '600' }}>{d.name}</td>
                        <td>{d.employee_count} active</td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteDept(d.id)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Designations */}
      {activeTab === 'desigs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.5rem' }}>
          <div className="glass-card">
            <h4 style={{ marginBottom: '1rem' }}>Add New Designation</h4>
            <form onSubmit={handleAddDesig}>
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  className="form-select"
                  value={desigForm.department_id}
                  onChange={e => setDesigForm({ ...desigForm, department_id: Number(e.target.value) })}
                  required
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Job Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Lead QA Engineer"
                  value={desigForm.title}
                  onChange={e => setDesigForm({ ...desigForm, title: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Plus size={16} /> Add Designation
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h4 style={{ marginBottom: '1rem' }}>Designations Directory ({designations.length})</h4>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No designations created yet.</td></tr>
                  ) : (
                    designations.map(des => (
                      <tr key={des.id}>
                        <td style={{ fontWeight: '600' }}>{des.title}</td>
                        <td><span className="badge badge-hr">{des.department_name}</span></td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteDesig(des.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Leave Types */}
      {activeTab === 'leaves' && (
        <div className="glass-card" style={{ maxWidth: '700px' }}>
          <h4 style={{ marginBottom: '1rem' }}>Standard Leave Quotas (Annual Business Rules)</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Quotas defined here apply automatically to all employees registered in the company.
          </p>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Annual Quota</th>
                  <th>Payment Type</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map(lt => (
                  <tr key={lt.id}>
                    <td style={{ fontWeight: '700' }}>{lt.name}</td>
                    <td>
                      <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
                        {lt.yearly_quota > 1000 ? 'Unlimited' : `${lt.yearly_quota} Days`}
                      </span>
                    </td>
                    <td>{lt.is_paid ? 'Paid' : 'Unpaid (Salary Deducted)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Public Holidays */}
      {activeTab === 'holidays' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.5rem' }}>
          <div className="glass-card">
            <h4 style={{ marginBottom: '1rem' }}>Add Public Holiday</h4>
            <form onSubmit={handleAddHoliday}>
              <div className="form-group">
                <label className="form-label">Holiday Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Pakistan Day"
                  value={holidayForm.name}
                  onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date (ISO) *</label>
                <input
                  type="date"
                  className="form-input"
                  value={holidayForm.holiday_date}
                  onChange={e => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Plus size={16} /> Add Holiday
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h4 style={{ marginBottom: '1rem' }}>Public Holidays ({holidays.length})</h4>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Holiday</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No public holidays added.</td></tr>
                  ) : (
                    holidays.map(h => (
                      <tr key={h.id}>
                        <td style={{ fontWeight: '600' }}>{h.holiday_date}</td>
                        <td>{h.name}</td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteHoliday(h.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
