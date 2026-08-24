import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { LEADS, leadById } from '../pages/dashboard/leads';

const BrokerContext = createContext(null);
const STARTING_BALANCE = 50000;
const DEFAULT_OWNED = LEADS.map((lead) => lead.id);

function storageKey(userId) {
  return `vantaro-broker-${userId}`;
}

function emptyState() {
  return { purchasedIds: DEFAULT_OWNED, transactions: [], balanceCents: STARTING_BALANCE };
}

function readState(userId) {
  if (!userId) return emptyState();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      purchasedIds: Array.isArray(parsed?.purchasedIds) && parsed.purchasedIds.length
        ? parsed.purchasedIds
        : DEFAULT_OWNED,
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

  const value = useMemo(() => {
    const purchased = state.purchasedIds
      .map((id) => leadById(id))
      .filter(Boolean);

    return {
      toast,
      showToast,
      purchased,
      purchasedIds: state.purchasedIds,
      transactions: state.transactions,
      balanceCents: state.balanceCents,
      buyLead(id) {
        const lead = leadById(id);
        if (!lead || state.purchasedIds.includes(id)) return { ok: false, reason: 'missing' };
        if (state.balanceCents < lead.priceCents) {
          showToast('Nicht genug Guthaben. Bitte zuerst aufladen.');
          return { ok: false, reason: 'funds' };
        }
        persist({
          purchasedIds: [...state.purchasedIds, id],
          balanceCents: state.balanceCents - lead.priceCents,
          transactions: [
            {
              id: `${Date.now()}-${id}`,
              type: 'purchase',
              label: `Lead ${lead.name}`,
              cents: -lead.priceCents,
              at: new Date().toISOString(),
            },
            ...state.transactions,
          ],
        });
        showToast(`${lead.name} liegt jetzt unter Meine Leads.`);
        return { ok: true };
      },
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
    };
  }, [persist, showToast, state, toast]);

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
