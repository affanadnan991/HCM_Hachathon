import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import FirstRunSetup from './pages/setup/FirstRunSetup';
import Login from './pages/auth/Login';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import OrgSetup from './pages/admin/OrgSetup';
import UserManagement from './pages/admin/UserManagement';
import EmployeeDirectory from './pages/hr/EmployeeDirectory';
import EmployeeProfile from './pages/employee/Profile';
import AttendancePunch from './pages/employee/AttendancePunch';
import AttendanceBoard from './pages/hr/AttendanceBoard';
import LeaveApply from './pages/employee/LeaveApply';
import LeaveApprovals from './pages/hr/LeaveApprovals';
import MonthlyPayroll from './pages/hr/MonthlyPayroll';
import MyPayslips from './pages/employee/MyPayslips';
import AdminDashboard from './pages/admin/AdminDashboard';
import HrDashboard from './pages/hr/HrDashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import AuditLogs from './pages/admin/AuditLogs';
import Announcements from './pages/common/Announcements';
import AiChatDrawer from './components/ai/AiChatDrawer';
import { Sparkles, Building2, Users, Calendar, Receipt, Clock, CheckCircle } from 'lucide-react';

function MainApp() {
  const { user, loading, setupStatus } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isDark, setIsDark] = useState(true);
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Synchronize Dark Theme class on <body>
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  }, [isDark]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          animation: 'pulse 2s infinite'
        }}>
          <Sparkles size={28} />
        </div>
        <div style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Loading HCM Lite...</div>
      </div>
    );
  }

  // 1. If First Run (Empty system), render Setup Wizard
  if (setupStatus?.isFirstRun) {
    return <FirstRunSetup />;
  }

  // 2. If Not Logged In, render Login
  if (!user) {
    return <Login />;
  }

  // 3. Authenticated Role-based Titles
  const tabTitles = {
    dashboard: user.role === 'ADMIN' ? 'Company Overview Dashboard' : user.role === 'HR' ? 'HR Operations Dashboard' : 'Personal Dashboard',
    org_setup: 'Organization Setup & Settings',
    user_management: 'HR & User Credentials Management',
    employees: 'Employee 360 Directory',
    attendance_board: 'Daily Attendance Board',
    attendance_punch: 'Web Check-In / Check-Out',
    leave_approvals: 'Leave Approvals Inbox',
    leave_apply: 'Leave Application & Quota Balance',
    payroll_draft: 'Monthly Payroll Run (Draft)',
    payroll_lock: 'Payroll Finalization & Lock',
    my_payslips: 'My Payslips & Compensation',
    profile: 'My Employee Profile',
    audit_logs: 'System Audit Trail Feed',
    announcements: 'Company Announcements & Notices'
  };

  return (
    <div className="app-layout">
      {/* Role-based Sidebar */}
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Content Area */}
      <div className="app-main">
        <Navbar
          currentTitle={tabTitles[currentTab] || 'HCM Lite'}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          onOpenAi={() => setIsAiOpen(true)}
        />

        <main className="app-content">
          {/* Active Tab Router */}
          {currentTab === 'dashboard' && user.role === 'ADMIN' && <AdminDashboard onOpenAi={() => setIsAiOpen(true)} />}
          {currentTab === 'dashboard' && user.role === 'HR' && <HrDashboard onOpenAi={() => setIsAiOpen(true)} />}
          {currentTab === 'dashboard' && user.role === 'EMPLOYEE' && <EmployeeDashboard onNavigate={setCurrentTab} onOpenAi={() => setIsAiOpen(true)} />}

          {currentTab === 'org_setup' && <OrgSetup />}
          {currentTab === 'user_management' && <UserManagement />}
          {currentTab === 'employees' && <EmployeeDirectory />}
          {currentTab === 'profile' && <EmployeeProfile />}
          {currentTab === 'attendance_punch' && <AttendancePunch />}
          {currentTab === 'attendance_board' && <AttendanceBoard />}
          {currentTab === 'leave_apply' && <LeaveApply />}
          {currentTab === 'leave_approvals' && <LeaveApprovals />}
          {(currentTab === 'payroll_draft' || currentTab === 'payroll_lock') && <MonthlyPayroll />}
          {currentTab === 'my_payslips' && <MyPayslips />}
          {currentTab === 'audit_logs' && <AuditLogs />}
          {currentTab === 'announcements' && <Announcements />}
        </main>
      </div>

      {/* Floating AI Assistant FAB (Accessible anywhere) */}
      <button
        className="btn btn-primary"
        onClick={() => setIsAiOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          borderRadius: '50px',
          padding: '0.75rem 1.25rem',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
          boxShadow: '0 8px 25px rgba(139, 92, 246, 0.45)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: '600',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}
      >
        <Sparkles size={18} /> Ask AI Assistant
      </button>

      {/* Slide-over AI Assistant Drawer */}
      <AiChatDrawer isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('HCM Error Boundary Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '2.5rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f87171',
              marginBottom: '1rem'
            }}>
              ⚠️
            </div>
            <h3 style={{ marginBottom: '0.5rem' }}>Application Recovered</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {this.state.error?.message || 'An unexpected rendering state was caught.'}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Refresh Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
