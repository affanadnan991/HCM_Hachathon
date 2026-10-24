import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Users, Clock, AlertTriangle, CalendarDays, CheckCircle2, 
  Sparkles, Award, TrendingUp, UserCheck, AlertCircle 
} from 'lucide-react';

export default function HrDashboard({ onOpenAi }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [aiSummary, setAiSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/hr');
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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading HR operations dashboard...</div>;
  if (!data) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Failed to load HR metrics.</div>;

  const { kpis, topLateComers, deptAbsenteeism, leaveUtilization, attritionRisk = [], absenceAnomalies = [] } = data;

  const handleSummarize = async () => {
    try {
      setSummarizing(true);
      const data = await api.post('/ai/summarize', { kpis, role: 'HR' });
      setAiSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div>
      {/* AI HR Summary Banner */}
      <div className="glass-card" style={{
        marginBottom: '1.75rem',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.3)',
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
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
            }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0 }}>HR Operations Intelligence & AI Insights</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Today's Attendance Rate is {kpis.attendanceRate}%. {kpis.presentToday} Present, {kpis.lateToday} Late, {kpis.onLeaveToday} on Approved Leave.
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
            borderTop: '1px solid rgba(6, 182, 212, 0.2)',
            animation: 'slideUp 0.3s ease'
          }}>
            <div style={{ fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--secondary)' }}>
              ⚡ AI-Generated Operational Insights:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '1.6' }}>
              {aiSummary.summary_bullets.map((bullet, idx) => (
                <li key={idx}>{bullet}</li>
              ))}
            </ul>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              ✨ AI-generated • Always verify against real-time biometric and attendance records
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="kpi-card">
          <div className="kpi-title">Total Staff</div>
          <div className="kpi-value">{kpis.totalEmployees}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Present Today</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{kpis.presentToday}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Late Today</div>
          <div className="kpi-value" style={{ color: 'var(--warning)' }}>{kpis.lateToday}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{kpis.latePercentage}% of arrivals</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">On Leave Today</div>
          <div className="kpi-value" style={{ color: 'var(--secondary)' }}>{kpis.onLeaveToday}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Pending Approvals</div>
          <div className="kpi-value" style={{ color: kpis.pendingApprovals > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {kpis.pendingApprovals}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leaves + Corrections</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Attendance Rate</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>{kpis.attendanceRate}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Top 5 Late Comers */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} style={{ color: 'var(--warning)' }} /> Top Late Comers (This Month)
          </h4>
          <div className="table-container">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Late Count</th>
                </tr>
              </thead>
              <tbody>
                {topLateComers.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                      No late arrivals recorded this month! Great punctuality.
                    </td>
                  </tr>
                ) : (
                  topLateComers.map((emp, i) => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{emp.first_name} {emp.last_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.employee_code}</div>
                      </td>
                      <td>{emp.department_name}</td>
                      <td>
                        <span className="badge badge-warning">{emp.late_count} times</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leave Utilization */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarDays size={18} style={{ color: 'var(--primary)' }} /> Leave Quota Utilization
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {leaveUtilization.map((l, i) => (
              <div key={i} style={{ padding: '0.75rem 1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: '600' }}>{l.type} Leave</span>
                  <span>{l.approved_days} d used ({l.quota === 'Unlimited' ? 'Unlimited' : `Quota: ${l.quota}`})</span>
                </div>
                {l.quota !== 'Unlimited' && (
                  <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, l.utilization_pct)}%`, height: '100%', background: 'var(--primary)' }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bonus Feature: Predictive Attrition Radar & Absence Anomaly Detection */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} style={{ color: '#10b981' }} /> 
              Predictive Workforce Retention & Absence Anomaly Radar
            </h4>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              AI/Statistical Risk Matrix combining punctuality, unpaid leave frequency, tenure cycles & salary parity
            </span>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
            Bonus Feature Enabled
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* Attrition Risk Breakdown */}
          <div style={{ background: 'var(--surface-hover)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={16} color="var(--warning)" /> Employee Attrition Risk Scores
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
              {attritionRisk.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No employee risk records available.</div>
              ) : (
                attritionRisk.map(emp => (
                  <div key={emp.employeeId} style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'var(--surface-solid)',
                    border: '1px solid var(--border)',
                    fontSize: '0.8125rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: '600' }}>{emp.name} ({emp.employeeCode})</span>
                      <span className={`badge ${
                        emp.riskLevel === 'HIGH' ? 'badge-danger' :
                        emp.riskLevel === 'MODERATE' ? 'badge-warning' : 'badge-success'
                      }`} style={{ fontSize: '0.6875rem' }}>
                        Risk: {emp.riskScore}/100 ({emp.riskLevel})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Dept: {emp.department} • {emp.actionRecommendation}
                    </div>
                    {emp.riskFactors.length > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Factors: {emp.riskFactors.join('; ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Absence Anomalies Feed */}
          <div style={{ background: 'var(--surface-hover)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} color="var(--primary)" /> Real-Time Absence Anomaly Alerts
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
              {absenceAnomalies.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '2rem 1rem' }}>
                  ✅ No attendance anomalies detected this period. Workforce punctuality is nominal!
                </div>
              ) : (
                absenceAnomalies.map((ano, idx) => (
                  <div key={idx} style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'var(--surface-solid)',
                    border: `1px solid ${ano.severity === 'HIGH' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    fontSize: '0.8125rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600' }}>{ano.name} ({ano.employeeCode})</span>
                      <span className={`badge ${ano.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.6875rem' }}>
                        {ano.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {ano.description}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
