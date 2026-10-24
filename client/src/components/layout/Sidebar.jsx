import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, Building2, Users, Clock, CalendarDays, 
  Receipt, ShieldCheck, Megaphone, UserCircle, LogOut, Sparkles, CheckSquare
} from 'lucide-react';

export default function Sidebar({ currentTab, onTabChange }) {
  const { user, logout } = useAuth();

  const adminMenu = [
    { id: 'dashboard', label: 'Company Overview', icon: LayoutDashboard },
    { id: 'org_setup', label: 'Organization Setup', icon: Building2 },
    { id: 'user_management', label: 'User & HR Logins', icon: Users },
    { id: 'payroll_lock', label: 'Payroll Finalize', icon: Receipt },
    { id: 'audit_logs', label: 'Audit Log Feed', icon: ShieldCheck },
    { id: 'announcements', label: 'Announcements', icon: Megaphone }
  ];

  const hrMenu = [
    { id: 'dashboard', label: 'HR Operations', icon: LayoutDashboard },
    { id: 'employees', label: 'Employee Directory', icon: Users },
    { id: 'attendance_board', label: 'Attendance Board', icon: Clock },
    { id: 'leave_approvals', label: 'Leave Inbox', icon: CalendarDays },
    { id: 'payroll_draft', label: 'Monthly Payroll', icon: Receipt },
    { id: 'announcements', label: 'Announcements', icon: Megaphone }
  ];

  const employeeMenu = [
    { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { id: 'attendance_punch', label: 'Check-In / Out', icon: Clock },
    { id: 'leave_apply', label: 'Leaves & Balance', icon: CalendarDays },
    { id: 'my_payslips', label: 'My Payslips', icon: Receipt },
    { id: 'profile', label: 'My Profile', icon: UserCircle },
    { id: 'announcements', label: 'Announcements', icon: Megaphone }
  ];

  const menu = user?.role === 'ADMIN' ? adminMenu : user?.role === 'HR' ? hrMenu : employeeMenu;

  const getRoleBadge = (role) => {
    switch(role) {
      case 'ADMIN': return <span className="badge badge-admin">Admin</span>;
      case 'HR': return <span className="badge badge-hr">HR Manager</span>;
      default: return <span className="badge badge-employee">Employee</span>;
    }
  };

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.125rem', lineHeight: 1.2 }}>HCM Lite</h2>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Saylani Hackathon</span>
        </div>
      </div>

      {/* User Info Capsule */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          color: 'var(--primary)'
        }}>
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: '600', fontSize: '0.875rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {user?.name || user?.email}
          </div>
          <div style={{ marginTop: '0.2rem' }}>
            {getRoleBadge(user?.role)}
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '1rem 0', flex: 1, overflowY: 'auto' }}>
        <div style={{
          padding: '0 1.5rem 0.5rem 1.5rem',
          fontSize: '0.7rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)'
        }}>
          Navigation
        </div>
        {menu.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
              style={{
                width: 'calc(100% - 1.5rem)',
                border: 'none',
                textAlign: 'left'
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={logout}
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'flex-start', color: '#f87171' }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
