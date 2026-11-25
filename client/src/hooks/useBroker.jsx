import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { MIN_LEAD_PACK, packageById, packTotalCents } from '../pages/dashboard/packages';
import { L } from '../lib/i18n';

const BrokerContext = createContext(null);

function makeInvoiceNumber(at = new Date()) {
  const d = new Date(at);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const suffix = String(d.getTime()).slice(-4);
  return `RE-${stamp}-${suffix}`;
}

function statusStorageKey(userId) {
  return `vantaro.broker.leadStatuses.${userId || 'guest'}`;
}

function readLeadStatuses(userId) {
  try {
    const raw = window.localStorage.getItem(statusStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLeadStatuses(userId, statuses) {
  try {
    window.localStorage.setItem(statusStorageKey(userId), JSON.stringify(statuses));
  } catch {
    /* ignore quota / private mode */
  }
}

function emptyState() {
  const at = new Date().toISOString();
  const pkg = packageById('pkv-deutschlandweit');
  const netCents = packTotalCents(pkg);
  return {
    transactions: [
      {
        id: 'demo-invoice',
        type: 'invoice',
        number: makeInvoiceNumber(at),
        label: L('10er-Paket PKV / deutschlandweit', 'PKV / nationwide package of 10'),
        packageId: 'pkv-deutschlandweit',
        cents: -netCents,
        taxCents: 0,
        leads: MIN_LEAD_PACK,
        status: 'paid',
        at,
      },
    ],
    leadQuota: MIN_LEAD_PACK,
    activePackageId: 'pkv-deutschlandweit',
  };
}

export function BrokerProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(emptyState);
  const [leadStatuses, setLeadStatuses] = useState({});
  const [toast, setToast] = useState('');
  const toastTimer = useRef(0);

  useEffect(() => {
    setState(emptyState());
    setLeadStatuses(readLeadStatuses(user?.id));
  }, [user?.id]);

  const updateState = useCallback((next) => {
    setState(next);
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const value = useMemo(() => {
    const invoices = state.transactions.filter((entry) => entry.type === 'invoice');

    return {
      toast,
      showToast,
      transactions: state.transactions,
      invoices,
      leadStatuses,
      activePackageId: state.activePackageId,
      activePackage: packageById(state.activePackageId),
      leadQuota: state.leadQuota,
      setLeadStatus(id, status) {
        const key = String(id || '');
        if (!key) return { ok: false };
        const next = { ...leadStatuses, [key]: status };
        setLeadStatuses(next);
        writeLeadStatuses(user?.id, next);
        return { ok: true };
      },
      selectPackage(packageId) {
        const pkg = packageById(packageId);
        if (!pkg) return { ok: false };
        updateState({ ...state, activePackageId: packageId });
        showToast(L(`${pkg.label} ist Ihr aktives Paket.`, `${pkg.label} is your active package.`));
        return { ok: true };
      },
      buyLeadPack(packageId, count = MIN_LEAD_PACK) {
        const pkg = packageById(packageId);
        if (!pkg) return { ok: false };
        const leads = Math.max(MIN_LEAD_PACK, Number(count) || MIN_LEAD_PACK);
        if (leads % 5 !== 0) {
          showToast(L(
            `Abnahme in 5er-Schritten möglich (mind. ${MIN_LEAD_PACK} Leads).`,
            `Orders are possible in steps of 5 (min. ${MIN_LEAD_PACK} leads).`,
          ));
          return { ok: false, reason: 'min' };
        }
        const netCents = packTotalCents(pkg, leads);
        const at = new Date().toISOString();
        updateState({
          ...state,
          activePackageId: packageId,
          leadQuota: state.leadQuota + leads,
          transactions: [
            {
              id: `${Date.now()}-invoice`,
              type: 'invoice',
              number: makeInvoiceNumber(at),
              label: L(`${leads}er-Paket ${pkg.label}`, `${pkg.label} package of ${leads}`),
              packageId,
              cents: -netCents,
              taxCents: 0,
              leads,
              status: 'paid',
              at,
            },
            ...state.transactions,
          ],
        });
        showToast(L(`Rechnung erstellt · ${leads} Leads im Kontingent.`, `Invoice created · ${leads} leads in your quota.`));
        return { ok: true };
      },
    };
  }, [updateState, showToast, state, toast, leadStatuses, user?.id]);

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
