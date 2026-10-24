import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Users, UserMinus, DollarSign, TrendingUp, ShieldCheck, 
  Sparkles, Building2, PieChart, Activity, AlertCircle 
} from 'lucide-react';

export default function AdminDashboard({ onOpenAi }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [aiSummary, setAiSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/admin');
      setData(res);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading executive dashboard...</div>;
  if (!data) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Failed to load dashboard data.</div>;

  const { kpis, headcountByDept, payrollByDept, genderStats, recentAudit } = data;

  const handleSummarize = async () => {
    try {
      setSummarizing(true);
      const data = await api.post('/ai/summarize', { kpis, role: 'ADMIN' });
      setAiSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div>
      {/* AI Executive Summary Banner */}
      <div className="glass-card" style={{
        marginBottom: '1.75rem',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        padding: '1.25rem 1.5rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: aiSummary ? '1rem' : 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
            }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0 }}>Executive Intelligence & AI Summarizer</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Headcount is {kpis.headcount} with {kpis.attritionRate}% attrition YTD. Latest payroll: PKR {kpis.totalPayrollCost?.toLocaleString()}.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSummarize} disabled={summarizing}>
              <Sparkles size={14} /> {summarizing ? 'Analyzing...' : 'Generate 3-Bullet Summary'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onOpenAi}>
              Chat with Assistant
            </button>
          </div>
        </div>

        {aiSummary && (
          <div style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(99, 102, 241, 0.2)',
            animation: 'slideUp 0.3s ease'
          }}>
            <div style={{ fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>
              ⚡ AI-Generated Executive Insights:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '1.6' }}>
              {aiSummary.summary_bullets.map((bullet, idx) => (
                <li key={idx}>{bullet}</li>
              ))}
            </ul>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              ✨ AI-generated • Always verify against audited payroll figures
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="kpi-card">
          <div className="kpi-title">Active Headcount</div>
          <div className="kpi-value">{kpis.headcount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Active + Probation staff</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Attrition Rate (YTD)</div>
          <div className="kpi-value" style={{ color: kpis.attritionRate > 5 ? 'var(--warning)' : 'var(--success)' }}>
            {kpis.attritionRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Exits ÷ Avg Headcount</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Payroll Cost (Latest)</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            PKR {kpis.totalPayrollCost?.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>{kpis.latestPayrollMonth}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Average Salary</div>
          <div className="kpi-value">
            PKR {kpis.avgSalary?.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Company-wide mean gross</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Headcount by Department */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} style={{ color: 'var(--primary)' }} /> Headcount by Department
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {headcountByDept.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>No departments registered yet.</span>
            ) : (
              headcountByDept.map((d, i) => {
                const pct = kpis.headcount > 0 ? (d.count / kpis.headcount) * 100 : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600' }}>{d.name}</span>
                      <span>{d.count} employees ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Gender Breakdown */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={18} style={{ color: 'var(--secondary)' }} /> Workforce Diversity
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {genderStats.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontWeight: '600' }}>{g.gender}</span>
                <span className="badge badge-employee">{g.count} staff</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live System Audit Feed */}
      <div className="glass-card">
        <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} style={{ color: 'var(--success)' }} /> Live Audit Trail Feed
        </h4>
        <div className="table-container">
          <table className="table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Entity</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="badge badge-admin">{log.action}</span>
                  </td>
                  <td style={{ fontWeight: '600' }}>{log.actor_email || 'System'}</td>
                  <td>{log.actor_role}</td>
                  <td>{log.entity} {log.entity_id ? `#${log.entity_id}` : ''}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
