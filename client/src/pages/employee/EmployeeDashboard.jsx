import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Clock, CalendarDays, Receipt, Megaphone, Bot, 
  CheckCircle2, ArrowRight, Sparkles, TrendingUp, AlertTriangle 
} from 'lucide-react';

export default function EmployeeDashboard({ onNavigate, onOpenAi }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/employee');
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

  const handleQuickCheckIn = async () => {
    setPunching(true);
    try {
      await api.post('/attendance/check-in', { source: 'web' });
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setPunching(false);
    }
  };

  const handleQuickCheckOut = async () => {
    setPunching(true);
    try {
      await api.post('/attendance/check-out', {});
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setPunching(false);
    }
  };

  if (loading) return <div>Loading personal dashboard...</div>;
  if (!data) return <div>Failed to load dashboard data.</div>;

  const { todayAttendance, weeklyHours, weeklyTarget, lateCountThisMonth, leaveBalances, lastPayslip, announcements } = data;
  const isCheckedIn = Boolean(todayAttendance);
  const isCheckedOut = Boolean(todayAttendance?.check_out_time);
  const weeklyPct = Math.min(100, Math.round((weeklyHours / weeklyTarget) * 100));

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      {/* Welcome Banner */}
      <div className="glass-card" style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>
            Welcome back, {user.name}! 👋
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Here is your daily activity overview, weekly work progress, and leave balances.
          </p>
        </div>

        <button className="btn btn-primary" onClick={onOpenAi}>
          <Bot size={16} /> Ask AI Assistant
        </button>
      </div>

      {/* Top 3 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Punch In Widget */}
        <div className="kpi-card">
          <div className="kpi-title">Today's Attendance</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.25rem 0' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: '800' }}>
              {isCheckedOut ? 'Completed' : isCheckedIn ? 'Checked In' : 'Not Clocked In'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            {todayAttendance?.check_in_time ? `In: ${new Date(todayAttendance.check_in_time).toLocaleTimeString()}` : 'Awaiting punch'}
          </div>
          <div>
            {!isCheckedIn ? (
              <button className="btn btn-primary btn-sm" onClick={handleQuickCheckIn} disabled={punching}>
                Punch In Now
              </button>
            ) : !isCheckedOut ? (
              <button className="btn btn-secondary btn-sm" onClick={handleQuickCheckOut} disabled={punching}>
                Punch Out
              </button>
            ) : (
              <span className="badge badge-success">Finished for Today</span>
            )}
          </div>
        </div>

        {/* Weekly Hours Progress */}
        <div className="kpi-card">
          <div className="kpi-title">Hours This Week</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.25rem 0' }}>
            {weeklyHours} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ 40.0 h</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden', margin: '0.5rem 0' }}>
            <div style={{ width: `${weeklyPct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #06b6d4)' }}></div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{weeklyPct}% of weekly expected target</div>
        </div>

        {/* Late Count This Month */}
        <div className="kpi-card">
          <div className="kpi-title">Late Arrivals (This Month)</div>
          <div className="kpi-value" style={{ color: lateCountThisMonth > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {lateCountThisMonth}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Threshold is 09:15 AM</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
        {/* Left Column: Leave Balances & Last Payslip */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Leave Balances */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarDays size={18} style={{ color: 'var(--primary)' }} /> Leave Quota Balances
              </h4>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('leave_apply')}>
                Apply Leave
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {leaveBalances.map(b => (
                <div key={b.id} style={{ padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.leave_type_name}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                    {b.total_quota > 1000 ? '∞' : b.remaining_days}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {b.total_quota > 1000 ? 'Unlimited' : `of ${b.total_quota} days`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Last Payslip Summary */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={18} style={{ color: 'var(--success)' }} /> Latest Finalized Payslip
              </h4>
              {lastPayslip && (
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('my_payslips')}>
                  View All
                </button>
              )}
            </div>

            {lastPayslip ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontWeight: '700' }}>{monthNames[lastPayslip.month]} {lastPayslip.year}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lastPayslip.days_worked} days worked • PKR {Number(lastPayslip.gross_salary).toLocaleString()} Gross</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--success)' }}>
                    PKR {Number(lastPayslip.net_salary).toLocaleString()}
                  </div>
                  <a href={`/api/payroll/payslips/${lastPayslip.id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                    Download PDF →
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No finalized payslips generated yet for this period.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Company Announcements */}
        <div className="glass-card">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Megaphone size={18} style={{ color: 'var(--secondary)' }} /> Company Notice Board
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {announcements.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active announcements right now.
              </div>
            ) : (
              announcements.map(ann => (
                <div
                  key={ann.id}
                  style={{
                    padding: '0.875rem',
                    background: ann.priority === 'URGENT' ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface-hover)',
                    border: `1px solid ${ann.priority === 'URGENT' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{ann.title}</span>
                    <span className={`badge ${ann.priority === 'URGENT' ? 'badge-danger' : 'badge-employee'}`}>
                      {ann.priority}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                    {ann.content}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(ann.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
