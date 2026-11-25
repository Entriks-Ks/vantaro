import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleCheck,
  Clock,
  Building2,
  CreditCard,
  Download,
  FileCheck2,
  FileText,
  LayoutGrid,
  List,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isComplaintBlockedLead, isComplaintFlowLead } from '../../lib/complaints';
import { fetchMyLeads } from '../../lib/leads';
import { formatAddress } from '../../lib/profile';
import {
  checkoutLeadPackage,
  collectBrowserPaymentMeta,
  downloadPaymentInvoice,
  fetchMyPayments,
  formatCardMask,
  openPaymentInvoice,
  paymentStatusLabel,
  syncMyPayment,
} from '../../lib/payments';
import {
  fetchMyDiscounts,
  matchingOneTimes,
  quoteForPackage,
  remainingTimeLabel,
  shopPriceUnits,
} from '../../lib/discounts';
import {
  ENERGY_DELIVERY_TYPES,
  ENERGY_PACKAGES,
  ENERGY_PRODUCTS,
  energyLeadTypeOf,
  energyPackageFor,
  energyProductById,
  energyTypeLabel,
  territoryFromBusinessAddress,
} from '../../lib/vertical';
import { displayName, formatDateTime, formatEuroExact } from './helpers';
import {
  LEAD_STATUSES,
  VIEW_MODES,
  pipelineStatusOf,
  statusLabel,
} from './leads';
import { ENERGY_UNIT_CENTS } from './packages';
import { useBroker } from '../../hooks/useBroker';
import { returnTo, returnLabel } from './LeadDetail';
import { OneTimeDiscountOffer, oneTimePickFor, visibleOneTimeOffers } from './OneTimeDiscountOffer';
import CheckoutConfirmModal from '../../components/CheckoutConfirmModal';
import { L } from '../../lib/i18n';

const MIN_LEADS = 10;
const LEAD_STEP = 5;

function defaultTimeframe() {
  return new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}
const PIPELINE_ICONS = {
  neu: Sparkles,
  kontaktiert: Phone,
  termin: CalendarClock,
  wiedervorlage: Clock,
  abgeschlossen: CircleCheck,
};
const PIPELINE_COLORS = {
  neu: '#56d3c4',
  kontaktiert: '#7aa2ff',
  termin: '#f0b45a',
  wiedervorlage: '#c4a0ff',
  abgeschlossen: '#9ad67a',
};

function presentLead(lead) {
  const address = [lead.street, lead.houseNumber, [lead.zip, lead.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    ...lead,
    name: lead.fullName || L('Ohne Namen', 'No name'),
    address: address || '—',
    packageId: energyLeadTypeOf(lead),
    packageLabel: energyTypeLabel(energyLeadTypeOf(lead)),
    status: pipelineStatusOf(lead),
  };
}

function leadInitials(lead) {
  const source = lead?.fullName || lead?.name || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function StatusMark({ lead }) {
  const Icon = PIPELINE_ICONS[lead.status] || Sparkles;
  const reviewing = lead.complaint?.status === 'pending';
  const blocked = isComplaintBlockedLead(lead);
  return (
    <span className="broker-status-stack">
      <span className="broker-status-iconic">
        <Icon size={14} aria-hidden="true" />
        {statusLabel(lead.status)}
      </span>
      {blocked ? <span className="broker-status is-blocked">{L('Gesperrt', 'Locked')}</span> : reviewing ? <span className="broker-status is-reported">{L('In Prüfung', 'Under review')}</span> : null}
    </span>
  );
}

export function EnergyHome() {
  const { user } = useAuth();
  const location = useLocation();
  const { leadStatuses } = useBroker();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchMyLeads()
      .then((payload) => {
        if (active) {
          setLeads((payload.leads || []).filter((lead) => !isComplaintFlowLead(lead)).map((lead) => ({
            ...presentLead(lead),
            status: pipelineStatusOf(lead, leadStatuses),
          })));
        }
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
  }, [leadStatuses]);

  const stats = useMemo(() => {
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((status) => [status.id, 0]));
    leads.forEach((lead) => {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    });
    return {
      total: leads.length,
      neu: byStatus.neu || 0,
      inProgress: (byStatus.kontaktiert || 0) + (byStatus.termin || 0) + (byStatus.wiedervorlage || 0),
      done: byStatus.abgeschlossen || 0,
      byStatus,
    };
  }, [leads]);

  const recent = leads.slice(0, 3);
  const pipelineTotal = Math.max(stats.total, 1);

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">{L('Ihr Tag', 'Your day')}</div>
          <h1>{L('Willkommen zurück, ', 'Welcome back, ')}<em>{displayName(user)}</em></h1>
          <p className="lede">{L('Schön, dass Sie da sind. Hier sehen Sie, welche Gespräche als Nächstes warten.', 'Good to see you. Here you can see which conversations are waiting next.')}</p>
        </div>
      </div>
      {error ? <div className="broker-alert">{error}</div> : null}
      <div className="broker-home-metrics broker-home-metrics--leads">
        <article className="broker-home-metric is-signal">
          <div className="broker-home-metric-body">
            <span>{L('Im Bestand', 'In your portfolio')}</span>
            <strong>{loading ? '—' : stats.total}</strong>
            <small>{L('Aktive Leads', 'Active leads')}</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><Users size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>{L('Neu', 'New')}</span>
            <strong>{loading ? '—' : stats.neu}</strong>
            <small>{L('Noch nicht kontaktiert', 'Not contacted yet')}</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><UserPlus size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>{L('In Bearbeitung', 'In progress')}</span>
            <strong>{loading ? '—' : stats.inProgress}</strong>
            <small>{L('Zugewiesen, Termin oder Wiedervorlage', 'Assigned, appointment or follow-up')}</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><MessageCircle size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>{L('Abgeschlossen', 'Closed')}</span>
            <strong>{loading ? '—' : stats.done}</strong>
            <small>{L('Erledigt oder nicht erschienen', 'Done or no-show')}</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><FileCheck2 size={22} /></span>
        </article>
      </div>

      <section className="broker-panel broker-home-pipeline">
        <div className="broker-panel-header">
          <div>
            <div className="eyebrow">{L('Trichter-Übersicht', 'Funnel overview')}</div>
            <h2>Pipeline</h2>
            <p>{L('Echtzeit-Verteilung Ihrer Leads nach aktuellem Bearbeitungsstand', 'Real-time distribution of your leads by current stage')}</p>
          </div>
          <Link to="/dashboard/leads" className="broker-pipeline-open">
            <span>{L('Board öffnen', 'Open board')}</span>
            <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>
        <div className="broker-pipeline-stack" aria-hidden={loading}>
          {LEAD_STATUSES.map((status) => {
            const value = stats.byStatus[status.id] || 0;
            if (value <= 0) return null;
            const pct = Math.max((value / pipelineTotal) * 100, 3);
            return (
              <span
                key={status.id}
                className="broker-pipeline-seg"
                style={{ width: `${pct}%`, background: PIPELINE_COLORS[status.id] }}
                title={L(`${status.label}: ${value} Leads`, `${status.label}: ${value} leads`)}
              />
            );
          })}
        </div>
        <div className="broker-pipeline-cards">
          {LEAD_STATUSES.map((status) => {
            const value = stats.byStatus[status.id] || 0;
            const pct = loading ? 0 : Math.round((value / pipelineTotal) * 100);
            const Icon = PIPELINE_ICONS[status.id] || Sparkles;
            const color = PIPELINE_COLORS[status.id];
            return (
              <Link key={status.id} className="broker-pipeline-card" to="/dashboard/leads" style={{ '--stage-color': color }}>
                <div className="broker-pipeline-card-top">
                  <span className="broker-pipeline-card-icon" style={{ color, background: `${color}18`, borderColor: `${color}35` }}>
                    <Icon size={18} />
                  </span>
                  <span className="broker-pipeline-card-pct">{loading ? '0%' : `${pct}%`}</span>
                </div>
                <div className="broker-pipeline-card-main">
                  <strong>{loading ? '—' : value}</strong>
                  <span className="broker-pipeline-card-label">{status.label}</span>
                </div>
                <div className="broker-pipeline-card-bar" style={{ background: color, width: `${Math.min(100, Math.max(6, pct))}%` }} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="broker-panel broker-home-recent">
        <div className="broker-panel-header">
          <div>
            <h2>{L('Aktuelle Leads', 'Recent leads')}</h2>
            <p>{L('Neue Chancen in Ihrem Bestand', 'New opportunities in your portfolio')}</p>
          </div>
          <Link to="/dashboard/leads" state={{ from: location.pathname + location.search }} className="broker-text-btn">{L('Alle anzeigen', 'Show all')}</Link>
        </div>
        {loading ? (
          <div className="broker-empty">
            <strong>{L('Leads werden geladen', 'Loading leads')}</strong>
            <p>{L('Einen Moment bitte.', 'One moment please.')}</p>
          </div>
        ) : recent.length ? (
          <ul className="broker-home-lead-list">
            {recent.map((lead) => (
              <li key={lead.id}>
                <Link to={`/dashboard/leads/${lead.id}`} state={{ from: location.pathname + location.search }}>
                  <span className="broker-home-lead-person">
                    <span className="broker-home-lead-avatar" aria-hidden="true">{leadInitials(lead)}</span>
                    <span className="broker-home-lead-copy">
                      <strong>{lead.name}</strong>
                      <small>{lead.packageLabel}{lead.address !== '—' ? ` · ${lead.address}` : ''}</small>
                    </span>
                  </span>
                  <span className={`broker-home-lead-phone${lead.phone ? '' : ' is-empty'}`}>
                    {lead.phone ? <><Phone size={15} aria-hidden="true" />{lead.phone}</> : null}
                  </span>
                  <span className={`broker-home-lead-email${lead.email ? '' : ' is-empty'}`}>
                    {lead.email ? <><Mail size={15} aria-hidden="true" />{lead.email}</> : null}
                  </span>
                  <StatusMark lead={lead} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="broker-empty">
            <strong>{L('Noch keine Leads', 'No leads yet')}</strong>
            <p>{L('Sobald wir Ihnen Chancen zuteilen, finden Sie sie hier und unter Meine Leads.', 'As soon as we allocate opportunities to you, you will find them here and under My leads.')}</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function EnergyLeads() {
  const navigate = useNavigate();
  const location = useLocation();
  const [leads, setLeads] = useState([]);
  const [packages, setPackages] = useState([]);
  const [view, setView] = useState('kanban');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 8;

  useEffect(() => {
    let active = true;
    fetchMyLeads()
      .then((payload) => {
        if (active) setLeads((payload.leads || []).map(presentLead));
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
  }, []);

  const visible = useMemo(() => (
    packages.length ? leads.filter((lead) => packages.includes(lead.packageId)) : leads
  ), [leads, packages]);
  const openCount = visible.filter((lead) => lead.status !== 'abgeschlossen').length;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageItems = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [packages, view]);

  const togglePackage = (id) => {
    setPackages((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  return (
    <div className="broker-page broker-page--wide">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">{L('Ihr Bestand', 'Your portfolio')}</div>
          <h1>{L('Meine Leads', 'My leads')}</h1>
          <p className="lede">{L('Leads und Termine im Board oder in der Liste. Filtern Sie nach Paket.', 'Leads and appointments on the board or in the list. Filter by package.')}</p>
        </div>
      </div>
      {error ? <div className="broker-alert">{error}</div> : null}
      <div className="broker-filterbar">
        <div className="broker-ins-filter" role="group" aria-label={L('Paket', 'Package')}>
          <span className="broker-ins-filter__label">{L('Paket', 'Package')}</span>
          <div className="broker-ins-filter__options">
            {ENERGY_PACKAGES.map((option) => {
              const checked = packages.includes(option.id);
              return (
                <label key={option.id} className={checked ? 'is-checked' : undefined}>
                  <input type="checkbox" checked={checked} onChange={() => togglePackage(option.id)} />
                  <span className="broker-ins-filter__box" aria-hidden="true">
                    {checked ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="broker-ins-filter__text">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="broker-filterbar-end">
          <div className="broker-pills broker-pills--view" role="tablist" aria-label={L('Ansicht', 'View')}>
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={view === mode.id}
                className={view === mode.id ? 'is-active' : undefined}
                onClick={() => setView(mode.id)}
                title={mode.label}
              >
                {mode.id === 'kanban' ? <LayoutGrid size={15} strokeWidth={2.1} /> : <List size={15} strokeWidth={2.1} />}
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
          <span className="broker-filter-count">
            {loading ? L('Laden…', 'Loading…') : L(`${openCount} ${openCount === 1 ? 'Chance' : 'Chancen'}`, `${openCount} ${openCount === 1 ? 'opportunity' : 'opportunities'}`)}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="broker-panel broker-empty">
          <span className="broker-inline-loader" aria-hidden="true" />
          <strong>{L('Leads werden geladen', 'Loading leads')}</strong>
          <p>{L('Einen Moment bitte.', 'One moment please.')}</p>
        </div>
      ) : !visible.length ? (
        <div className="broker-panel broker-empty">
          <strong>{packages.length ? L('Keine Leads für dieses Paket', 'No leads for this package') : L('Noch keine Leads', 'No leads yet')}</strong>
          <p>
            {packages.length
              ? L('Anderes Paket wählen — oder alle Häkchen entfernen, um den gesamten Bestand zu sehen.', 'Choose another package — or clear all checkboxes to see your entire portfolio.')
              : L('Sobald wir Ihnen Chancen zuteilen, erscheinen sie hier.', 'As soon as we allocate opportunities to you, they will appear here.')}
          </p>
        </div>
      ) : view === 'list' ? (
        <>
          <div className="broker-panel broker-list-panel">
            <div className="broker-list-head" aria-hidden="true">
              <span>{L('Kontakt', 'Contact')}</span>
              <span>{L('Paket', 'Package')}</span>
              <span>{L('Art', 'Type')}</span>
              <span>Status</span>
              <span>{L('Gebiet', 'Area')}</span>
            </div>
            <div className="broker-list-body">
              {pageItems.map((lead) => (
                <button key={lead.id} type="button" className="broker-list-row" onClick={() => navigate(`/dashboard/leads/${lead.id}`, { state: { from: location.pathname + location.search } })}>
                  <span className="broker-list-name">
                    <strong>{lead.name}</strong>
                    <small>{lead.address}</small>
                  </span>
                  <span className="broker-list-meta">{lead.packageLabel}</span>
                  <span className="broker-list-meta">{lead.deliveryType === 'appointment' ? L('Termin', 'Appointment') : 'Lead'}</span>
                  <StatusMark lead={lead} />
                  <span className="broker-list-meta">{[lead.zip, lead.city].filter(Boolean).join(' ') || '—'}</span>
                </button>
              ))}
            </div>
          </div>
          {visible.length > pageSize ? (
            <div className="broker-pagination">
              <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{L('Zurück', 'Back')}</button>
              <span>{L(`Seite ${page} von ${totalPages}`, `Page ${page} of ${totalPages}`)}</span>
              <button type="button" className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{L('Weiter', 'Next')}</button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="broker-kanban">
          {LEAD_STATUSES.map((column) => {
            const items = visible.filter((lead) => lead.status === column.id);
            const Icon = PIPELINE_ICONS[column.id] || Sparkles;
            return (
              <section key={column.id} className={`broker-kanban-column${column.id === 'abgeschlossen' ? ' is-closed' : ''}`}>
                <header>
                  <span className={`broker-kanban-icon broker-kanban-icon--${column.id}`} aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <div className="broker-kanban-title">
                    <strong tabIndex={0} aria-describedby={`kanban-hint-${column.id}`}>{column.label}</strong>
                    <small id={`kanban-hint-${column.id}`} role="tooltip">{column.hint}</small>
                  </div>
                  <span className="broker-count">{items.length}</span>
                </header>
                <div className="broker-kanban-stack">
                  {items.length ? items.map((lead) => (
                    <article
                      key={lead.id}
                      className="broker-panel broker-lead-card is-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/dashboard/leads/${lead.id}`, { state: { from: location.pathname + location.search } })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') navigate(`/dashboard/leads/${lead.id}`, { state: { from: location.pathname + location.search } });
                      }}
                    >
                      <strong>{lead.name}</strong>
                      <span>{lead.packageLabel}</span>
                      <small>{lead.address}</small>
                    </article>
                  )) : (
                    <div className="broker-kanban-empty">{L('Keine Leads', 'No leads')}</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EnergyOrders() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const businessAddress = user?.profile?.businessAddress || {};
  const defaultTerritory = formatAddress(businessAddress) || territoryFromBusinessAddress(businessAddress);
  const businessLabel = defaultTerritory;

  const [qtyByProduct, setQtyByProduct] = useState({});
  const [deliveryByProduct, setDeliveryByProduct] = useState({
    photovoltaic: 'lead',
    heat_pump: 'lead',
  });
  const [territoryByProduct, setTerritoryByProduct] = useState({});
  const [editingTerritory, setEditingTerritory] = useState({});
  const [payments, setPayments] = useState([]);
  const [discounts, setDiscounts] = useState({ standing: null, oneTimes: [] });
  const [oneTimePick, setOneTimePick] = useState({ id: '', key: '' });
  const [leadsUsed, setLeadsUsed] = useState(0);
  const [checkout, setCheckout] = useState(null);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [activeProductId, setActiveProductId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paying, setPaying] = useState(false);
  const [syncingId, setSyncingId] = useState('');
  const [invoiceBusyId, setInvoiceBusyId] = useState('');

  async function loadBilling() {
    const [leadPayload, paymentPayload, discountPayload] = await Promise.all([
      fetchMyLeads().catch(() => ({ leads: [] })),
      fetchMyPayments().catch(() => ({ payments: [] })),
      fetchMyDiscounts().catch(() => ({ standing: null, oneTimes: [] })),
    ]);
    setLeadsUsed((leadPayload.leads || []).length);
    setPayments(paymentPayload.payments || []);
    setDiscounts({
      standing: discountPayload.standing || null,
      oneTimes: discountPayload.oneTimes || [],
    });
  }

  useEffect(() => {
    loadBilling().catch(() => setLeadsUsed(0));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get('payment');
    if (!payment) return;
    if (payment === 'success') {
      setNotice(L('Zahlung erfolgreich. Ihre Anforderung wurde angelegt.', 'Payment successful. Your request has been created.'));
      setError('');
    } else if (payment === 'failed') {
      setError(params.get('error') || L('Zahlung fehlgeschlagen oder abgebrochen.', 'Payment failed or was cancelled.'));
      setNotice('');
    } else if (payment === 'pending') {
      setNotice(L('Zahlung noch nicht abgeschlossen. Der Status wird aktualisiert, sobald die Bank bestätigt.', 'Payment not yet completed. The status will be updated as soon as the bank confirms.'));
      setError('');
    }
    loadBilling().catch(() => {});
    navigate('/dashboard/paket', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    if (!defaultTerritory) return;
    setTerritoryByProduct((prev) => {
      const next = { ...prev };
      ENERGY_PRODUCTS.forEach((product) => {
        if (!String(next[product.id] || '').trim()) next[product.id] = defaultTerritory;
      });
      return next;
    });
  }, [defaultTerritory]);

  const getQty = (productId) => Math.max(MIN_LEADS, qtyByProduct[productId] ?? MIN_LEADS);
  const setQty = (productId, next) => {
    const parsed = Math.round(Number(next) / LEAD_STEP) * LEAD_STEP;
    setQtyByProduct((prev) => ({ ...prev, [productId]: Math.max(MIN_LEADS, parsed || MIN_LEADS) }));
  };
  const getDelivery = (productId) => deliveryByProduct[productId] || 'lead';
  const getTerritory = (productId) => territoryByProduct[productId] ?? defaultTerritory;
  const setTerritory = (productId, value) => {
    setTerritoryByProduct((prev) => ({ ...prev, [productId]: value }));
  };

  const checkoutPkg = checkout
    ? energyPackageFor(checkout.productId, checkout.deliveryType)
    : null;
  const leadQuota = payments
    .filter((entry) => entry.status === 'paid')
    .reduce((sum, entry) => sum + (entry.leadCount || 0), 0);
  const leadsRemaining = Math.max(0, leadQuota - leadsUsed);
  const activeProduct = energyProductById(activeProductId);
  const checkoutOffers = checkoutPkg
    ? visibleOneTimeOffers(
      matchingOneTimes(discounts.oneTimes, checkoutPkg.id, checkoutPkg.id),
      oneTimePick,
      checkoutPkg.id,
    )
    : [];
  const checkoutUseId = oneTimePickFor(checkoutPkg?.id, oneTimePick);
  const checkoutQuote = checkoutPkg
    ? quoteForPackage(
      ENERGY_UNIT_CENTS * checkout.qty,
      checkout.qty,
      checkoutPkg.id,
      discounts,
      checkoutPkg.id,
      checkoutUseId,
    )
    : null;
  const checkoutNet = checkoutQuote?.netCents ?? ENERGY_UNIT_CENTS * (checkout?.qty || MIN_LEADS);

  const openCheckout = (productId) => {
    const deliveryType = getDelivery(productId);
    const qty = getQty(productId);
    const territory = getTerritory(productId).trim();
    setError('');
    setNotice('');
    if (!territory) {
      setError(L('Bitte geben Sie ein Gebiet (PLZ oder Ort) an. Standard ist Ihre Geschäftsadresse.', 'Please enter an area (postcode or town). The default is your business address.'));
      return;
    }
    setTimeframe(defaultTimeframe());
    setCheckout({ productId, deliveryType, qty, territory });
  };

  const confirmPay = async () => {
    if (!checkoutPkg || !checkout || paying || !checkout.acceptedTerms) return;
    const area = String(checkout.territory || '').trim();
    const period = String(timeframe || '').trim();
    if (!area || !period) {
      setError(L('Gebiet und gewünschter Zeitraum sind erforderlich.', 'Area and desired timeframe are required.'));
      return;
    }
    setPaying(true);
    setError('');
    setNotice('');
    try {
      const result = await checkoutLeadPackage({
        packageId: checkoutPkg.id,
        requestedCount: checkout.qty,
        territory: area,
        desiredTimeframe: period,
        browser: collectBrowserPaymentMeta(),
        useOneTimeId: checkoutUseId || undefined,
        acceptedTerms: true,
      });
      setActiveProductId(checkout.productId);
      // Keep the dialog open ("Weiterleitung zur Bank…") until the browser leaves for the bank.
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      throw new Error(L('Zahlungsseite der Bank konnte nicht geöffnet werden.', "The bank's payment page could not be opened."));
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  };

  const handleSyncPending = async (paymentId) => {
    if (!paymentId || syncingId) return;
    setSyncingId(paymentId);
    setError('');
    try {
      const result = await syncMyPayment(paymentId);
      await loadBilling();
      if (result.outcome === 'paid') {
        setNotice(L('Zahlung bestätigt. Ihre Anforderung wurde angelegt.', 'Payment confirmed. Your request has been created.'));
      } else if (result.outcome === 'failed') {
        setError(L('Zahlung wurde von der Bank abgelehnt oder abgebrochen.', 'Payment was declined by the bank or cancelled.'));
      } else {
        setNotice(L('Zahlung ist bei der Bank noch offen. Bitte später erneut prüfen.', 'Payment is still pending at the bank. Please check again later.'));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingId('');
    }
  };

  const runInvoiceAction = async (paymentId, action) => {
    if (!paymentId || invoiceBusyId) return;
    setInvoiceBusyId(paymentId);
    setError('');
    try {
      await action(paymentId);
    } catch (err) {
      setError(err.message || L('Rechnung konnte nicht geladen werden.', 'The invoice could not be loaded.'));
    } finally {
      setInvoiceBusyId('');
    }
  };

  return (
    <div className="broker-page">
      <div className="broker-heading broker-billing-heading">
        <div>
          <div className="eyebrow">{L('Abrechnung', 'Billing')}</div>
          <h1>{L('Pakete & Guthaben', 'Packages & balance')}</h1>
          <p className="lede">
            {L('Zwei Pakete: Photovoltaik und Wärmepumpe. Wählen Sie Lead oder Termin, Gebiet und Menge.', 'Two packages: solar PV and heat pump. Choose lead or appointment, area and quantity.')}
          </p>
        </div>
      </div>
      <div className="broker-panel broker-simple-status-bar">
        <div className="broker-status-stat">
          <span className="broker-stat-label">{L('Verfügbares Kontingent', 'Available quota')}</span>
          <div className="broker-stat-val">
            <strong>{L(`${leadsRemaining} Leads`, `${leadsRemaining} leads`)}</strong>
            <small>{L(`(${leadsUsed} zugewiesen von ${leadQuota} gebucht)`, `(${leadsUsed} assigned of ${leadQuota} booked)`)}</small>
          </div>
        </div>
        <div className="broker-status-divider" />
        <div className="broker-status-stat">
          <span className="broker-stat-label">{L('Aktives Paket', 'Active package')}</span>
          <div className="broker-stat-val">
            <strong>{activeProduct?.label || L('Kein Paket gewählt', 'No package selected')}</strong>
          </div>
        </div>
        <div className="broker-status-divider" />
        <div className="broker-status-stat broker-status-stat--link">
          <span className="broker-stat-label">{L('Rechnungsadresse', 'Billing address')}</span>
          <Link to="/dashboard/unternehmen" state={{ from: '/dashboard/paket' }} className="broker-status-action">
            <Building2 size={15} aria-hidden="true" />
            <span>{L('Bearbeiten', 'Edit')}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
      {notice ? <div className="broker-alert broker-alert--ok"><Check size={16} /><span>{notice}</span></div> : null}
      {error ? <div className="broker-alert"><span>{error}</span></div> : null}
      <div className="broker-simple-packages">
        {ENERGY_PRODUCTS.map((product) => {
          const deliveryType = getDelivery(product.id);
          const qty = getQty(product.id);
          const territory = getTerritory(product.id);
          const deliveryMeta = ENERGY_DELIVERY_TYPES.find((item) => item.id === deliveryType);
          const active = activeProductId === product.id;
          const unitLabel = deliveryType === 'appointment' ? L('Termin', 'appointment') : L('Lead', 'lead');
          const unitPlural = deliveryType === 'appointment' ? L('Termine', 'appointments') : L('Leads', 'leads');
          const pkg = energyPackageFor(product.id, deliveryType);
          const offers = visibleOneTimeOffers(
            matchingOneTimes(discounts.oneTimes, pkg?.id, pkg?.id),
            oneTimePick,
            pkg?.id,
          );
          const selectedOffer = oneTimePickFor(pkg?.id, oneTimePick);
          const quote = quoteForPackage(ENERGY_UNIT_CENTS * qty, qty, pkg?.id, discounts, pkg?.id, selectedOffer);
          const units = shopPriceUnits(quote, qty, ENERGY_UNIT_CENTS);
          const discounted = quote.discountCents > 0;
          return (
            <article
              key={product.id}
              className={`broker-panel broker-simple-pkg-card${product.featured ? ' is-featured' : ''}`}
            >
              <div className="broker-simple-pkg-header">
                <div>
                  <span className="broker-simple-scope-tag">
                    {deliveryType === 'appointment' ? L('Termin', 'Appointment') : 'Lead'}
                  </span>
                  <h3>{product.title}</h3>
                </div>
                <div className="broker-simple-price-box">
                  {/* Total for the selected quantity; updates with the stepper. */}
                  {discounted ? <s>{formatEuroExact(quote.listCents)}</s> : null}
                  <strong>{formatEuroExact(quote.netCents)}</strong>
                  <small>{L('für', 'for')} {qty} {unitPlural} · {formatEuroExact(units.netUnit)} / {unitLabel}</small>
                  {quote.standing ? (
                    <em className="broker-disc-badge">
                      {L('Ihre Konditionen', 'Your terms')}
                      {quote.standing.discount?.expiresAt
                        ? ` · ${remainingTimeLabel(quote.standing.discount.expiresAt)}`
                        : ''}
                    </em>
                  ) : null}
                </div>
              </div>

              <p className="broker-simple-desc">{product.description}</p>
              <OneTimeDiscountOffer
                offers={offers}
                selectedId={selectedOffer}
                onChange={(id) => setOneTimePick(id && pkg?.id ? { id, key: pkg.id } : { id: '', key: '' })}
                unitLabel={unitLabel}
              />

              <div className="broker-simple-stepper-row broker-energy-pkg-row">
                <span className="broker-simple-row-label">{L('Art', 'Type')}</span>
                <div className="broker-energy-delivery-seg" role="tablist" aria-label={L(`${product.label} Art`, `${product.label} type`)}>
                  {ENERGY_DELIVERY_TYPES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={deliveryType === option.id}
                      className={deliveryType === option.id ? 'is-active' : undefined}
                      onClick={() => setDeliveryByProduct((prev) => ({ ...prev, [product.id]: option.id }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="broker-energy-pkg-hint broker-energy-pkg-hint--inline">{deliveryMeta?.description}</p>

              <div className="broker-energy-pkg-field broker-energy-pkg-field--compact">
                <div className="broker-energy-pkg-field-head">
                  <span className="broker-simple-row-label">{L('Gebiet / Standort', 'Area / location')}</span>
                  <button
                    type="button"
                    className="broker-text-btn broker-energy-pkg-link"
                    onClick={() => {
                      setEditingTerritory((prev) => {
                        const next = !prev[product.id];
                        if (next && !String(getTerritory(product.id) || '').trim()) {
                          setTerritory(product.id, defaultTerritory || businessLabel);
                        }
                        return { ...prev, [product.id]: next };
                      });
                    }}
                  >
                    {editingTerritory[product.id] ? L('Fertig', 'Done') : L('Ändern', 'Change')}
                  </button>
                </div>
                {editingTerritory[product.id] ? (
                  <input
                    className="broker-energy-pkg-input"
                    value={territory}
                    onChange={(event) => setTerritory(product.id, event.target.value)}
                    placeholder={L('z. B. 50667 Köln', 'e.g. 50667 Köln')}
                    aria-label={L(`${product.label} Gebiet`, `${product.label} area`)}
                    autoFocus
                  />
                ) : (
                  <p className="broker-energy-pkg-address">
                    {territory.trim() || businessLabel || L('Noch keine Adresse hinterlegt', 'No address on file yet')}
                  </p>
                )}
              </div>

              <div className="broker-simple-stepper-row">
                <span className="broker-simple-row-label">{L(`${unitPlural}-Menge (ab 10)`, `Number of ${unitPlural} (min. 10)`)}</span>
                <div className="broker-qty-controls">
                  <button type="button" onClick={() => setQty(product.id, qty - LEAD_STEP)} disabled={qty <= MIN_LEADS} aria-label={L('Weniger', 'Fewer')}>−</button>
                  <input type="number" min={MIN_LEADS} step={LEAD_STEP} value={qty} onChange={(event) => setQty(product.id, event.target.value)} />
                  <button type="button" onClick={() => setQty(product.id, qty + LEAD_STEP)} aria-label={L('Mehr', 'More')}>+</button>
                </div>
              </div>

              <div className="broker-simple-sum-row">
                <span>{L('Gesamt', 'Total')} ({qty} × {formatEuroExact(ENERGY_UNIT_CENTS)}, {L('ohne MwSt.', 'excl. VAT')})</span>
                <strong>
                  {discounted ? <s>{formatEuroExact(quote.listCents)}</s> : null}
                  {discounted ? ' ' : null}
                  {formatEuroExact(quote.netCents)}
                </strong>
              </div>

              <div className="broker-simple-btn-group">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={paying}
                  onClick={() => openCheckout(product.id)}
                >
                  <CreditCard size={15} /> {L(`${unitPlural} buchen`, `Book ${unitPlural}`)}
                </button>
                {!active ? (
                  <button type="button" className="btn btn-outline" onClick={() => setActiveProductId(product.id)}>{L('Als Standard merken', 'Save as default')}</button>
                ) : (
                  <span className="broker-simple-active-badge"><Check size={13} /> {L('Aktiver Standard', 'Active default')}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {checkoutPkg && checkout ? (
        <CheckoutConfirmModal
          productLabel={checkoutPkg.label}
          productTitle={checkoutPkg.title}
          quantity={checkout.qty}
          unitPlural={String(checkoutPkg.id || '').includes('APPOINTMENT') ? L('Termine', 'appointments') : L('Leads', 'leads')}
          listCents={checkoutQuote?.listCents ?? ENERGY_UNIT_CENTS * checkout.qty}
          netCents={checkoutNet}
          discountLines={checkoutQuote?.lines || []}
          details={(
            <div className="checkout-modal__fields">
              <label className="checkout-modal__field">
                {L('Gebiet / PLZ', 'Area / postcode')}
                <input
                  value={checkout.territory}
                  onChange={(event) => setCheckout((prev) => (prev ? { ...prev, territory: event.target.value } : prev))}
                  placeholder={L('z. B. 50667 oder Köln', 'e.g. 50667 or Köln')}
                  disabled={paying}
                  required
                />
              </label>
              <label className="checkout-modal__field">
                {L('Gewünschter Zeitraum', 'Desired timeframe')}
                <input
                  value={timeframe}
                  onChange={(event) => setTimeframe(event.target.value)}
                  placeholder={L('z. B. Oktober 2026', 'e.g. October 2026')}
                  disabled={paying}
                  required
                />
              </label>
            </div>
          )}
          offers={(
            <OneTimeDiscountOffer
              offers={checkoutOffers}
              selectedId={checkoutUseId}
              onChange={(id) => setOneTimePick(id ? { id, key: checkoutPkg.id } : { id: '', key: '' })}
              unitLabel={String(checkoutPkg.id || '').includes('APPOINTMENT') ? L('Termin', 'appointment') : L('Lead', 'lead')}
              compact
            />
          )}
          acceptedTerms={Boolean(checkout.acceptedTerms)}
          onAcceptedTermsChange={(acceptedTerms) => setCheckout((prev) => (prev ? { ...prev, acceptedTerms } : prev))}
          error={error}
          paying={paying}
          onCancel={() => setCheckout(null)}
          onConfirm={confirmPay}
        />
      ) : null}

      <section className="broker-panel broker-invoice-panel">
        <div className="broker-panel-header">
          <div>
            <h2>{L('Rechnungen', 'Invoices')}</h2>
            <p>{L('Übersicht Ihrer bisherigen Zahlungen', 'Overview of your payments to date')}</p>
          </div>
          <Link to="/dashboard/zahlung" state={{ from: '/dashboard/paket' }} className="broker-pipeline-open">
            <span>{L('Alle Zahlungen', 'All payments')}</span>
            <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>
        {payments.length ? (
          <div className="broker-invoice-table-wrap">
            <table className="broker-invoice-table">
              <thead>
                <tr>
                  <th>{L('Rechnung', 'Invoice')}</th>
                  <th>{L('Datum', 'Date')}</th>
                  <th>{L('Paket', 'Package')}</th>
                  <th>{L('Zahlung', 'Payment')}</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>{L('Betrag', 'Amount')}</th>
                  <th className="broker-invoice-actions-col">{L('Aktion', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <button
                        type="button"
                        className="broker-invoice-id"
                        disabled={Boolean(invoiceBusyId)}
                        onClick={() => runInvoiceAction(invoice.id, openPaymentInvoice)}
                      >
                        <FileText size={14} />
                        {invoice.invoiceNumber}
                      </button>
                    </td>
                    <td>{formatDateTime(invoice.paidAt || invoice.createdAt)}</td>
                    <td>
                      <strong>{invoice.packageLabel}</strong>
                      <small>{invoice.leadCount} {String(invoice.leadType || '').includes('APPOINTMENT') ? L('Termine', 'appointments') : L('Leads', 'leads')}</small>
                    </td>
                    <td>
                      <span>{formatCardMask(invoice)}</span>
                    </td>
                    <td>
                      <span className={`broker-invoice-status ${invoice.status === 'paid' ? 'is-paid' : 'is-unpaid'}`}>
                        {invoice.status === 'paid' ? L('Bezahlt', 'Paid') : paymentStatusLabel(invoice.status)}
                      </span>
                      {invoice.status === 'pending' ? (
                        <button
                          type="button"
                          className="broker-text-btn"
                          style={{ display: 'block', marginTop: 6 }}
                          disabled={Boolean(syncingId)}
                          onClick={() => handleSyncPending(invoice.id)}
                        >
                          {syncingId === invoice.id ? L('Prüfe…', 'Checking…') : L('Status prüfen', 'Check status')}
                        </button>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className="broker-inv-amount">{formatEuroExact(invoice.netCents || invoice.grossCents)}</strong>
                      {invoice.discountCents > 0 ? (
                        <small>{L('inkl. Rabatt', 'incl. discount')} · {formatEuroExact(invoice.listCents)}</small>
                      ) : null}
                    </td>
                    <td>
                      <div className="broker-invoice-actions">
                        <button
                          type="button"
                          className="broker-invoice-action"
                          title={L('Rechnung öffnen', 'Open invoice')}
                          aria-label={L(`Rechnung ${invoice.invoiceNumber} öffnen`, `Open invoice ${invoice.invoiceNumber}`)}
                          disabled={Boolean(invoiceBusyId)}
                          onClick={() => runInvoiceAction(invoice.id, openPaymentInvoice)}
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          type="button"
                          className="broker-invoice-action"
                          title={L('Rechnung herunterladen', 'Download invoice')}
                          aria-label={L(`Rechnung ${invoice.invoiceNumber} herunterladen`, `Download invoice ${invoice.invoiceNumber}`)}
                          disabled={Boolean(invoiceBusyId)}
                          onClick={() => runInvoiceAction(invoice.id, downloadPaymentInvoice)}
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="broker-empty">
            <p>{L('Noch keine Rechnungen vorhanden.', 'No invoices yet.')}</p>
          </div>
        )}
      </section>
    </div>
  );
}

