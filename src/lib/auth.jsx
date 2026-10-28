import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, authenticated: false, username: null, configured: true });

  const refresh = useCallback(async () => {
    try {
      const s = await api.session();
      setState({ loading: false, ...s });
    } catch {
      setState((prev) => ({ ...prev, loading: false, authenticated: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const s = await api.login(username, password);
    setState((prev) => ({ ...prev, loading: false, ...s }));
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setState((prev) => ({ ...prev, authenticated: false, username: null }));
  }, []);

  const value = useMemo(() => ({ ...state, login, logout, refresh }), [state, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
