import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, UserPlus, FileSpreadsheet, Download, Search, Filter, 
  Eye, AlertCircle, CheckCircle2, X, Sparkles, Building, Calendar, DollarSign
} from 'lucide-react';

export default function EmployeeDirectory() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Modal States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [selected360Emp, setSelected360Emp] = useState(null);

  // Register Form State
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    gender: 'Male',
    department_id: '',
    designation_id: '',
    date_of_joining: new Date().toISOString().split('T')[0],
    basic_salary: 80000,
    temporary_password: 'Welcome@123'
  });

  // CSV Engine State
  const [csvText, setCsvText] = useState('');
  const [dryRunReport, setDryRunReport] = useState(null);
  const [importing, setImporting] = useState(false);

  const loadData = async (page = 1) => {
    try {
      setLoading(true);
      const [empRes, depts, desigs] = await Promise.all([
        api.get(`/employees?page=${page}&limit=10&search=${encodeURIComponent(search)}&department_id=${selectedDept}`),
        api.get('/company/departments'),
        api.get('/company/designations')
      ]);
      setEmployees(empRes.employees);
      setPagination(empRes.pagination);
      setDepartments(depts);
      setDesignations(desigs);
      if (depts.length > 0 && !form.department_id) {
        setForm(prev => ({ ...prev, department_id: depts[0].id }));
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [search, selectedDept]);

  // Live Salary Calculations
  const basic = Number(form.basic_salary) || 0;
  const hra = Number((basic * 0.40).toFixed(2));
  const medical = Number((basic * 0.10).toFixed(2));
  const gross = Number((basic * 1.50).toFixed(2));

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employees', form);
      setMsg({ text: `Employee registered successfully! Temporary password: ${form.temporary_password}`, type: 'success' });
      setShowRegisterModal(false);
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        gender: 'Male',
        department_id: departments[0]?.id || '',
        designation_id: '',
        date_of_joining: new Date().toISOString().split('T')[0],
        basic_salary: 80000,
        temporary_password: 'Welcome@123'
      });
      loadData(1);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  // CSV Dry-Run Execution
  const handleDryRun = async () => {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        alert('Please provide headers and at least one row of data.');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || '';
        });
        return obj;
      });

      const report = await api.post('/employees/csv-dry-run', { rows });
      setDryRunReport(report);
    } catch (err) {
      alert(err.message || 'Dry run failed.');
    }
  };

  const handleCommitImport = async () => {
    if (!dryRunReport || dryRunReport.valid_rows.length === 0) return;
    setImporting(true);
    try {
      await api.post('/employees/csv-import', { validRows: dryRunReport.valid_rows });
      setMsg({ text: `Successfully imported ${dryRunReport.valid_rows.length} employees!`, type: 'success' });
      setShowCsvModal(false);
      setDryRunReport(null);
      setCsvText('');
      loadData(1);
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleExportCsv = () => {
    window.open('/api/employees/csv-export', '_blank');
  };

  const open360Modal = async (empId) => {
    try {
      const profile = await api.get(`/employees/${empId}`);
      setSelected360Emp(profile);
    } catch (err) {
      alert(err.message);
    }
  };

  const sampleCsvTemplate = `first_name,last_name,email,department,date_of_joining,basic_salary,phone
Hamza,Farooq,hamza.f@company.com,Engineering,2026-02-15,85000,03001112233
Ayesha,Siddiqua,ayesha.s@company.com,Human Resources,2026-03-01,95000,03004445566`;

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

      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, maxWidth: '600px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Search by name, email, or EMP code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

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

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExportCsv} title="Export CSV">
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCsvModal(true)}>
            <FileSpreadsheet size={16} /> Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
            <UserPlus size={16} /> Register Employee
          </button>
        </div>
      </div>

      {/* Employee Table */}
      <div className="glass-card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee Name</th>
                <th>Department & Designation</th>
                <th>Joining Date</th>
                <th>Gross Salary</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No employees found matching criteria. Use 'Register Employee' or 'Import CSV' to add staff.
                  </td>
                </tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id}>
                    <td><span className="badge badge-employee">{emp.employee_code}</span></td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{emp.first_name} {emp.last_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.email}</div>
                    </td>
                    <td>
                      <div>{emp.department_name || 'Unassigned'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.designation_title || 'General'}</div>
                    </td>
                    <td>{emp.date_of_joining}</td>
                    <td style={{ fontWeight: '700' }}>
                      PKR {emp.gross_salary?.toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${emp.employment_status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                        {emp.employment_status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => open360Modal(emp.id)}>
                        <Eye size={14} /> 360 View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} employees)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadData(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Register Employee */}
      {showRegisterModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-solid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={20} style={{ color: 'var(--primary)' }} /> Register New Employee
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRegisterModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.last_name}
                    onChange={e => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Email Address (Login Username) *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className="form-select"
                    value={form.department_id}
                    onChange={e => setForm({ ...form, department_id: Number(e.target.value) })}
                    required
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <select
                    className="form-select"
                    value={form.designation_id}
                    onChange={e => setForm({ ...form, designation_id: Number(e.target.value) || null })}
                  >
                    <option value="">General Designation</option>
                    {designations.map(des => (
                      <option key={des.id} value={des.id}>{des.title} ({des.department_name})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Date of Joining *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date_of_joining}
                    onChange={e => setForm({ ...form, date_of_joining: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0300-1234567"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Salary Structure Live Preview Box */}
              <div style={{
                background: 'var(--surface-hover)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                margin: '1rem 0',
                border: '1px solid var(--border)'
              }}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Basic Salary (PKR) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.basic_salary}
                    onChange={e => setForm({ ...form, basic_salary: Number(e.target.value) })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>HRA (40%):</span>
                    <div style={{ fontWeight: '600' }}>PKR {hra.toLocaleString()}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Medical (10%):</span>
                    <div style={{ fontWeight: '600' }}>PKR {medical.toLocaleString()}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Gross Salary (1.5x):</span>
                    <div style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1.05rem' }}>
                      PKR {gross.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Temporary Password (Requires change on first login)</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.temporary_password}
                  onChange={e => setForm({ ...form, temporary_password: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Employee & Provision Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: CSV Import with Dry-Run Error Engine */}
      {showCsvModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-solid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} style={{ color: 'var(--primary)' }} /> CSV Import with Dry-Run Validation
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowCsvModal(false); setDryRunReport(null); }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Paste comma-separated data below. The system will perform a <strong>dry run</strong> to check required fields, duplicate emails, invalid dates, and positive salary before committing.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCsvText(sampleCsvTemplate)}
                style={{ marginBottom: '0.5rem' }}
              >
                📋 Load Sample CSV Template
              </button>
              <textarea
                className="form-textarea"
                rows="6"
                placeholder="first_name,last_name,email,department,date_of_joining,basic_salary..."
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={handleDryRun}>
                <Sparkles size={16} /> Execute Dry Run Validation
              </button>
            </div>

            {/* Dry Run Results */}
            {dryRunReport && (
              <div style={{
                background: 'var(--surface-hover)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL ROWS</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{dryRunReport.total_rows}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>VALID ROWS</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--success)' }}>
                      {dryRunReport.valid_rows_count}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INVALID ROWS</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--danger)' }}>
                      {dryRunReport.invalid_rows_count}
                    </div>
                  </div>
                </div>

                {/* Errors List */}
                {dryRunReport.errors.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h5 style={{ color: '#f87171', marginBottom: '0.5rem' }}>⚠️ Validation Errors Detected:</h5>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.75rem' }}>
                        <thead>
                          <tr>
                            <th>Row #</th>
                            <th>Field</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dryRunReport.errors.map((err, i) => (
                            <tr key={i}>
                              <td><span className="badge badge-danger">Row {err.row}</span></td>
                              <td style={{ fontWeight: '600' }}>{err.field}</td>
                              <td style={{ color: '#f87171' }}>{err.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Commit Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDryRunReport(null)}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={dryRunReport.valid_rows_count === 0 || importing}
                    onClick={handleCommitImport}
                  >
                    {importing ? 'Importing...' : `Commit Import (${dryRunReport.valid_rows_count} Employees)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 3: Employee 360 View */}
      {selected360Emp && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-solid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: 'var(--primary)', color: 'white', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem'
                }}>
                  {selected360Emp.first_name[0]}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{selected360Emp.first_name} {selected360Emp.last_name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {selected360Emp.employee_code} • {selected360Emp.department_name} • {selected360Emp.designation_title || 'General'}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected360Emp(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Salary Breakdown Summary */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
              background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BASIC</span>
                <div style={{ fontWeight: '700' }}>PKR {selected360Emp.basic_salary?.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>HRA (40%)</span>
                <div style={{ fontWeight: '700' }}>PKR {selected360Emp.hra_allowance?.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MEDICAL (10%)</span>
                <div style={{ fontWeight: '700' }}>PKR {selected360Emp.medical_allowance?.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GROSS (1.5x)</span>
                <div style={{ fontWeight: '800', color: 'var(--primary)' }}>PKR {selected360Emp.gross_salary?.toLocaleString()}</div>
              </div>
            </div>

            {/* Leave Balances */}
            <h4 style={{ marginBottom: '0.75rem' }}>Annual Leave Balances</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {selected360Emp.leaveBalances?.map(lb => (
                <div key={lb.id} className="kpi-card" style={{ padding: '0.875rem' }}>
                  <div className="kpi-title">{lb.leave_type_name}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                    {lb.remaining_days} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ {lb.total_quota > 1000 ? '∞' : lb.total_quota}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Contact Details */}
            <h4 style={{ marginBottom: '0.75rem' }}>Contact & Personal Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              <div><strong>Email:</strong> {selected360Emp.email}</div>
              <div><strong>Phone:</strong> {selected360Emp.phone || 'Not provided'}</div>
              <div><strong>Gender:</strong> {selected360Emp.gender}</div>
              <div><strong>Joining Date:</strong> {selected360Emp.date_of_joining}</div>
              <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {selected360Emp.address || 'Not provided'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
