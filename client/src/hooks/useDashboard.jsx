import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchDashboard } from '../lib/auth';
import { useAuth } from './useAuth';

const DashboardContext = createContext(null);

const EMPTY_STATS = {
  newChances: 0,
  appointments: 0,
  openTasks: 0,
  creditCents: 0,
};

const ADMIN_POLL_MS = 30000;

export function DashboardProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const payload = await fetchDashboard();
      setData(payload);
      setError('');
      return payload;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetchDashboard()
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isAdmin || !user?.id) return undefined;
    const timer = window.setInterval(() => {
      refresh({ silent: true }).catch(() => {});
    }, ADMIN_POLL_MS);
    return () => window.clearInterval(timer);
  }, [isAdmin, user?.id, refresh]);

  const value = useMemo(
    () => ({
      loading,
      error,
      stats: data?.stats || EMPTY_STATS,
      admin: data?.admin || null,
      user: data?.user || user,
      refresh,
    }),
    [loading, error, data, user, refresh],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}
