import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Moon, Sun, Bot, Bell } from 'lucide-react';

export default function Navbar({ currentTitle, isDark, onToggleTheme, onOpenAi }) {
  const { user, setupStatus } = useAuth();

  return (
    <header className="app-navbar">
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
          {currentTitle}
        </h1>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {setupStatus?.company?.company_name || 'Saylani HCM Lite'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* AI Assistant Quick Launcher */}
        <button
          className="btn btn-primary btn-sm"
          onClick={onOpenAi}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.35)'
          }}
        >
          <Bot size={16} /> AI Assistant
        </button>

        {/* Theme Toggle Button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onToggleTheme}
          title="Toggle Theme"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
