import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';

const BrokerContext = createContext(null);
const STARTING_BALANCE = 50000;

function storageKey(userId) {
  return `vantaro-broker-${userId}`;
}

function emptyState() {
  return { transactions: [], balanceCents: STARTING_BALANCE };
}

function readState(userId) {
  if (!userId) return emptyState();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
      balanceCents: Number.isFinite(parsed?.balanceCents) ? parsed.balanceCents : STARTING_BALANCE,
    };
  } catch {
    return emptyState();
  }
}

function writeState(userId, state) {
  if (!userId) return;
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function BrokerProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => readState(user?.id));
  const [toast, setToast] = useState('');
  const toastTimer = useRef(0);

  useEffect(() => {
    setState(readState(user?.id));
  }, [user?.id]);

  const persist = useCallback((next) => {
    setState(next);
    writeState(user?.id, next);
  }, [user?.id]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const value = useMemo(() => ({
    toast,
    showToast,
    transactions: state.transactions,
    balanceCents: state.balanceCents,
    addFunds(cents = 25000) {
      persist({
        ...state,
        balanceCents: state.balanceCents + cents,
        transactions: [
          {
            id: `${Date.now()}-topup`,
            type: 'topup',
            label: 'Guthaben aufgeladen',
            cents,
            at: new Date().toISOString(),
          },
          ...state.transactions,
        ],
      });
      showToast('250 € wurden Ihrem Guthaben gutgeschrieben.');
    },
  }), [persist, showToast, state, toast]);

  return (
    <BrokerContext.Provider value={value}>
      {children}
      {toast ? <div className="broker-toast" role="status">{toast}</div> : null}
    </BrokerContext.Provider>
  );
}

export function useBroker() {
  const context = useContext(BrokerContext);
  if (!context) {
    throw new Error('useBroker must be used within BrokerProvider');
  }
  return context;
}
