import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchDashboard } from '../lib/auth';
import { useAuth } from './useAuth';

const DashboardContext = createContext(null);

const EMPTY_STATS = {
  newChances: 0,
  appointments: 0,
  openTasks: 0,
  creditCents: 0,
};

export function DashboardProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  const value = useMemo(
    () => ({
      loading,
      error,
      stats: data?.stats || EMPTY_STATS,
      admin: data?.admin || null,
      user: data?.user || user,
    }),
    [loading, error, data, user],
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
