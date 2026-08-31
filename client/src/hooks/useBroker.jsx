import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { decideReportOutcome, LEAD_REPORT_DETAIL_MIN, LEADS, leadById } from '../pages/dashboard/leads';
import { MIN_LEAD_PACK, packageById, packTotalCents } from '../pages/dashboard/packages';

const BrokerContext = createContext(null);
const DEMO_OWNED = LEADS.slice(0, 5).map((lead) => lead.id);

function defaultStatuses(ids = DEMO_OWNED) {
  return Object.fromEntries(ids.map((id) => [String(id), 'neu']));
}

function defaultNotes(ids = DEMO_OWNED) {
  return Object.fromEntries(ids.map((id) => [String(id), '']));
}

function makeInvoiceNumber(at = new Date()) {
  const d = new Date(at);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const suffix = String(d.getTime()).slice(-4);
  return `INV-${stamp}-${suffix}`;
}

/** Demo-only in-memory state — resets to 10 on every page reload. */
function emptyState() {
  const at = new Date().toISOString();
  const pkg = packageById('pkv-deutschlandweit');
  const netCents = packTotalCents(pkg);
  return {
    purchasedIds: DEMO_OWNED,
    transactions: [
      {
        id: 'demo-invoice',
        type: 'invoice',
        number: makeInvoiceNumber(at),
        label: '10er-Paket PKV / deutschlandweit',
        packageId: 'pkv-deutschlandweit',
        cents: -netCents,
        taxCents: Math.round(netCents * 0.19),
        leads: MIN_LEAD_PACK,
        status: 'paid',
        at,
      },
    ],
    leadQuota: MIN_LEAD_PACK,
    leadStatuses: defaultStatuses(),
    leadNotes: defaultNotes(),
    leadFollowUps: {},
    leadReports: {},
    activePackageId: 'pkv-deutschlandweit',
  };
}

export function BrokerProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(emptyState);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(0);

  useEffect(() => {
    setState(emptyState());
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
    const purchased = state.purchasedIds
      .map((id) => leadById(id))
      .filter(Boolean)
      .map((lead) => ({
        ...lead,
        status: state.leadStatuses[String(lead.id)] || 'neu',
      }));

    const leadsUsed = purchased.length;
    const leadQuota = Math.max(state.leadQuota, leadsUsed);
    const leadsRemaining = Math.max(0, leadQuota - leadsUsed);
    const invoices = state.transactions.filter((entry) => entry.type === 'invoice');

    return {
      toast,
      showToast,
      purchased,
      purchasedIds: state.purchasedIds,
      transactions: state.transactions,
      invoices,
      leadStatuses: state.leadStatuses,
      leadNotes: state.leadNotes,
      leadFollowUps: state.leadFollowUps,
      leadReports: state.leadReports,
      activePackageId: state.activePackageId,
      activePackage: packageById(state.activePackageId),
      leadQuota,
      leadsUsed,
      leadsRemaining,
      quotaLabel: `${leadsUsed}/${leadQuota}`,
      setLeadStatus(id, status) {
        const numericId = Number(id);
        if (!state.purchasedIds.includes(numericId)) {
          return { ok: false };
        }
        updateState({
          ...state,
          leadStatuses: { ...state.leadStatuses, [String(numericId)]: status },
        });
        return { ok: true };
      },
      setLeadNotes(id, notes) {
        const numericId = Number(id);
        if (!state.purchasedIds.includes(numericId)) {
          return { ok: false };
        }
        updateState({
          ...state,
          leadNotes: { ...state.leadNotes, [String(numericId)]: String(notes ?? '') },
        });
        return { ok: true };
      },
      setLeadFollowUp(id, date, time) {
        const numericId = Number(id);
        if (!state.purchasedIds.includes(numericId) || !date || !time) {
          return { ok: false };
        }
        updateState({
          ...state,
          leadStatuses: { ...state.leadStatuses, [String(numericId)]: 'wiedervorlage' },
          leadFollowUps: {
            ...state.leadFollowUps,
            [String(numericId)]: { date, time, at: new Date().toISOString() },
          },
        });
        showToast('Wiedervorlage gespeichert.');
        return { ok: true };
      },
      reportLead(id, reasonId, detail, proofName = '') {
        const numericId = Number(id);
        const text = String(detail || '').trim();
        if (!state.purchasedIds.includes(numericId) || !reasonId || text.length < LEAD_REPORT_DETAIL_MIN) {
          return { ok: false };
        }
        const status = decideReportOutcome(reasonId);
        updateState({
          ...state,
          leadReports: {
            ...state.leadReports,
            [String(numericId)]: {
              reasonId,
              detail: text,
              proofName: String(proofName || '').trim(),
              status,
              at: new Date().toISOString(),
            },
          },
        });
        if (status === 'gutgeschrieben' || status === 'teilweise') {
          showToast('Reklamation angenommen — Gutschrift wird verbucht.');
        } else if (status === 'abgelehnt') {
          showToast('Reklamation abgelehnt.');
        } else if (status === 'infos_noetig') {
          showToast('Weitere Nachweise erforderlich.');
        } else {
          showToast('Reklamation eingereicht — Vantaro prüft Ihren Fall.');
        }
        return { ok: true, status };
      },
      selectPackage(packageId) {
        const pkg = packageById(packageId);
        if (!pkg) return { ok: false };
        updateState({ ...state, activePackageId: packageId });
        showToast(`${pkg.label} ist Ihr aktives Paket.`);
        return { ok: true };
      },
      buyLeadPack(packageId, count = MIN_LEAD_PACK) {
        const pkg = packageById(packageId);
        const leads = Math.max(MIN_LEAD_PACK, Number(count) || MIN_LEAD_PACK);
        if (!pkg) return { ok: false };
        if (leads % MIN_LEAD_PACK !== 0) {
          showToast(`Mindestabnahme: ${MIN_LEAD_PACK} Leads (in 10er-Schritten).`);
          return { ok: false, reason: 'min' };
        }
        const netCents = packTotalCents(pkg, leads);
        const at = new Date().toISOString();
        updateState({
          ...state,
          activePackageId: packageId,
          leadQuota: Math.max(state.leadQuota, state.purchasedIds.length) + leads,
          transactions: [
            {
              id: `${Date.now()}-invoice`,
              type: 'invoice',
              number: makeInvoiceNumber(at),
              label: `${leads}er-Paket ${pkg.label}`,
              packageId,
              cents: -netCents,
              taxCents: Math.round(netCents * 0.19),
              leads,
              status: 'paid',
              at,
            },
            ...state.transactions,
          ],
        });
        showToast(`Rechnung erstellt · ${leads} Leads freigeschaltet.`);
        return { ok: true };
      },
      buyLead(id) {
        const lead = leadById(id);
        if (!lead || state.purchasedIds.includes(id)) return { ok: false, reason: 'missing' };
        const quota = Math.max(state.leadQuota, state.purchasedIds.length);
        if (state.purchasedIds.length >= quota) {
          showToast('Kein freies Kontingent mehr. Bitte unter Zahlung nachkaufen.');
          return { ok: false, reason: 'quota' };
        }
        updateState({
          ...state,
          purchasedIds: [...state.purchasedIds, id],
          leadStatuses: { ...state.leadStatuses, [String(id)]: 'neu' },
          leadNotes: { ...state.leadNotes, [String(id)]: '' },
          transactions: [
            {
              id: `${Date.now()}-${id}`,
              type: 'assign',
              label: `Lead zugewiesen: ${lead.name}`,
              cents: 0,
              leads: 1,
              at: new Date().toISOString(),
            },
            ...state.transactions,
          ],
        });
        showToast(`${lead.name} liegt jetzt unter Meine Leads.`);
        return { ok: true };
      },
    };
  }, [updateState, showToast, state, toast]);

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
