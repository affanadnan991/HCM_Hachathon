import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupStatus, setSetupStatus] = useState({ isFirstRun: false, isConfigured: false, company: null });

  const fetchSetupStatus = useCallback(async () => {
    try {
      const data = await api.get('/auth/setup-status');
      setSetupStatus(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch setup status:', err);
      return null;
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/me');
      setUser(res.user);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      api.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await fetchSetupStatus();
      await fetchCurrentUser();
    };

    initAuth();

    const handleLogout = () => {
      setUser(null);
    };

    window.addEventListener('auth-logout', handleLogout);
    return () => window.removeEventListener('auth-logout', handleLogout);
  }, [fetchSetupStatus, fetchCurrentUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    api.setToken(res.token);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  const setupFirstRun = async (setupData) => {
    const res = await api.post('/auth/setup', setupData);
    api.setToken(res.token);
    setUser(res.user);
    await fetchSetupStatus();
    return res;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword });
    setUser(prev => prev ? { ...prev, must_change_password: false } : null);
    return res;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      setupStatus,
      login,
      logout,
      setupFirstRun,
      changePassword,
      refreshUser: fetchCurrentUser,
      refreshSetupStatus: fetchSetupStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
