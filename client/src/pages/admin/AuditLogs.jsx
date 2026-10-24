import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ShieldCheck, Search, Filter, Calendar, Code, ChevronDown, ChevronRight } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const url = selectedEntity ? `/audit?entity=${selectedEntity}&limit=100` : `/audit?limit=100`;
      const res = await api.get(url);
      setLogs(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [selectedEntity]);

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={22} style={{ color: 'var(--success)' }} /> System Audit Trail
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Immutable chronological record of create, update, approve, and finalize actions with before/after state diffs.
          </span>
        </div>

        <select
          className="form-select"
          style={{ width: '200px' }}
          value={selectedEntity}
          onChange={e => setSelectedEntity(e.target.value)}
        >
          <option value="">All Entities</option>
          <option value="EMPLOYEE">Employees</option>
          <option value="LEAVE_REQUEST">Leave Requests</option>
          <option value="PAYROLL_RUN">Payroll Runs</option>
          <option value="ATTENDANCE">Attendance</option>
          <option value="SETTINGS">Company Settings</option>
          <option value="USER">User Accounts</option>
        </select>
      </div>

      <div className="glass-card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No audit log records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr onClick={() => toggleExpand(log.id)} style={{ cursor: 'pointer' }}>
                        <td>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td>
                          <span className={`badge ${
                            log.action.includes('FINALIZE') || log.action.includes('APPROVE') ? 'badge-success' :
                            log.action.includes('REJECT') || log.action.includes('DELETE') ? 'badge-danger' :
                            log.action.includes('UPDATE') ? 'badge-warning' : 'badge-admin'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{log.actor_name || log.actor_email || 'System Root'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role: {log.actor_role}</div>
                        </td>
                        <td><strong>{log.entity}</strong></td>
                        <td>{log.entity_id ? `#${log.entity_id}` : '-'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>

                      {/* Expandable JSON Diff Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" style={{ background: 'var(--surface-hover)', padding: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>BEFORE STATE (JSON):</span>
                                <pre style={{
                                  background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.75rem', overflowX: 'auto', maxHeight: '180px', marginTop: '0.25rem'
                                }}>
                                  {log.before_json ? JSON.stringify(JSON.parse(log.before_json), null, 2) : 'null (Newly Created)'}
                                </pre>
                              </div>

                              <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)' }}>AFTER STATE (JSON):</span>
                                <pre style={{
                                  background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.75rem', overflowX: 'auto', maxHeight: '180px', marginTop: '0.25rem'
                                }}>
                                  {log.after_json ? JSON.stringify(JSON.parse(log.after_json), null, 2) : 'null'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
