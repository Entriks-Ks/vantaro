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
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isComplaintFlowLead } from '../../lib/complaints';
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
import { TEST_PACKAGE_PRICE_CENTS } from './packages';
import { useBroker } from '../../hooks/useBroker';

const MIN_LEADS = 10;
const LEAD_STEP = 5;
const ENERGY_UNIT_CENTS = TEST_PACKAGE_PRICE_CENTS ?? 100;

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
    name: lead.fullName || 'Ohne Namen',
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

function StatusMark({ status, complaint }) {
  const Icon = PIPELINE_ICONS[status] || Sparkles;
  const reviewing = complaint?.status === 'pending';
  return (
    <span className="broker-status-stack">
      <span className="broker-status-iconic">
        <Icon size={14} aria-hidden="true" />
        {statusLabel(status)}
      </span>
      {reviewing ? <span className="broker-status is-reported">In Prüfung</span> : null}
    </span>
  );
}

export function EnergyHome() {
  const { user } = useAuth();
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
          <div className="eyebrow">Ihr Tag</div>
          <h1>Willkommen zurück, <em>{displayName(user)}</em></h1>
          <p className="lede">Schön, dass Sie da sind. Hier sehen Sie, welche Gespräche als Nächstes warten.</p>
        </div>
      </div>
      {error ? <div className="broker-alert">{error}</div> : null}
      <div className="broker-home-metrics broker-home-metrics--leads">
        <article className="broker-home-metric is-signal">
          <div className="broker-home-metric-body">
            <span>Im Bestand</span>
            <strong>{loading ? '—' : stats.total}</strong>
            <small>Aktive Leads</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><Users size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>Neu</span>
            <strong>{loading ? '—' : stats.neu}</strong>
            <small>Noch nicht kontaktiert</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><UserPlus size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>In Bearbeitung</span>
            <strong>{loading ? '—' : stats.inProgress}</strong>
            <small>Zugewiesen, Termin oder Wiedervorlage</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><MessageCircle size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>Abgeschlossen</span>
            <strong>{loading ? '—' : stats.done}</strong>
            <small>Erledigt oder nicht erschienen</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><FileCheck2 size={22} /></span>
        </article>
      </div>

      <section className="broker-panel broker-home-pipeline">
        <div className="broker-panel-header">
          <div>
            <div className="eyebrow">Trichter-Übersicht</div>
            <h2>Pipeline</h2>
            <p>Echtzeit-Verteilung Ihrer Leads nach aktuellem Bearbeitungsstand</p>
          </div>
          <Link to="/dashboard/leads" className="broker-pipeline-open">
            <span>Board öffnen</span>
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
                title={`${status.label}: ${value} Leads`}
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
            <h2>Aktuelle Leads</h2>
            <p>Neue Chancen in Ihrem Bestand</p>
          </div>
          <Link to="/dashboard/leads" className="broker-text-btn">Alle anzeigen</Link>
        </div>
        {loading ? (
          <div className="broker-empty">
            <strong>Leads werden geladen</strong>
            <p>Einen Moment bitte.</p>
          </div>
        ) : recent.length ? (
          <ul className="broker-home-lead-list">
            {recent.map((lead) => (
              <li key={lead.id}>
                <Link to={`/dashboard/leads/${lead.id}`}>
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
                  <StatusMark status={lead.status} complaint={lead.complaint} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Leads</strong>
            <p>Sobald wir Ihnen Chancen zuteilen, finden Sie sie hier und unter Meine Leads.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function EnergyLeads() {
  const navigate = useNavigate();
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
          <div className="eyebrow">Ihr Bestand</div>
          <h1>Meine Leads</h1>
          <p className="lede">Leads und Termine im Board oder in der Liste. Filtern Sie nach Paket.</p>
        </div>
      </div>
      {error ? <div className="broker-alert">{error}</div> : null}
      <div className="broker-filterbar">
        <div className="broker-ins-filter" role="group" aria-label="Paket">
          <span className="broker-ins-filter__label">Paket</span>
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
          <div className="broker-pills broker-pills--view" role="tablist" aria-label="Ansicht">
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
            {loading ? 'Laden…' : `${openCount} ${openCount === 1 ? 'Chance' : 'Chancen'}`}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="broker-panel broker-empty">
          <span className="broker-inline-loader" aria-hidden="true" />
          <strong>Leads werden geladen</strong>
          <p>Einen Moment bitte.</p>
        </div>
      ) : !visible.length ? (
        <div className="broker-panel broker-empty">
          <strong>{packages.length ? 'Keine Leads für dieses Paket' : 'Noch keine Leads'}</strong>
          <p>
            {packages.length
              ? 'Anderes Paket wählen — oder alle Häkchen entfernen, um den gesamten Bestand zu sehen.'
              : 'Sobald wir Ihnen Chancen zuteilen, erscheinen sie hier.'}
          </p>
        </div>
      ) : view === 'list' ? (
        <>
          <div className="broker-panel broker-list-panel">
            <div className="broker-list-head" aria-hidden="true">
              <span>Kontakt</span>
              <span>Paket</span>
              <span>Art</span>
              <span>Status</span>
              <span>Gebiet</span>
            </div>
            <div className="broker-list-body">
              {pageItems.map((lead) => (
                <button key={lead.id} type="button" className="broker-list-row" onClick={() => navigate(`/dashboard/leads/${lead.id}`)}>
                  <span className="broker-list-name">
                    <strong>{lead.name}</strong>
                    <small>{lead.address}</small>
                  </span>
                  <span className="broker-list-meta">{lead.packageLabel}</span>
                  <span className="broker-list-meta">{lead.deliveryType === 'appointment' ? 'Termin' : 'Lead'}</span>
                  <StatusMark status={lead.status} complaint={lead.complaint} />
                  <span className="broker-list-meta">{[lead.zip, lead.city].filter(Boolean).join(' ') || '—'}</span>
                </button>
              ))}
            </div>
          </div>
          {visible.length > pageSize ? (
            <div className="broker-pagination">
              <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Zurück</button>
              <span>Seite {page} von {totalPages}</span>
              <button type="button" className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Weiter</button>
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
                      onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') navigate(`/dashboard/leads/${lead.id}`);
                      }}
                    >
                      <strong>{lead.name}</strong>
                      <span>{lead.packageLabel}</span>
                      <small>{lead.address}</small>
                    </article>
                  )) : (
                    <div className="broker-kanban-empty">Keine Leads</div>
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
    const [leadPayload, paymentPayload] = await Promise.all([
      fetchMyLeads().catch(() => ({ leads: [] })),
      fetchMyPayments().catch(() => ({ payments: [] })),
    ]);
    setLeadsUsed((leadPayload.leads || []).length);
    setPayments(paymentPayload.payments || []);
  }

  useEffect(() => {
    loadBilling().catch(() => setLeadsUsed(0));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get('payment');
    if (!payment) return;
    if (payment === 'success') {
      setNotice('Zahlung erfolgreich. Ihre Anforderung wurde angelegt.');
      setError('');
    } else if (payment === 'failed') {
      setError(params.get('error') || 'Zahlung fehlgeschlagen oder abgebrochen.');
      setNotice('');
    } else if (payment === 'pending') {
      setNotice('Zahlung noch nicht abgeschlossen. Der Status wird aktualisiert, sobald die Bank bestätigt.');
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
  const checkoutNet = ENERGY_UNIT_CENTS;

  const openCheckout = (productId) => {
    const deliveryType = getDelivery(productId);
    const qty = getQty(productId);
    const territory = getTerritory(productId).trim();
    setError('');
    setNotice('');
    if (!territory) {
      setError('Bitte geben Sie ein Gebiet (PLZ oder Ort) an. Standard ist Ihre Geschäftsadresse.');
      return;
    }
    setTimeframe(defaultTimeframe());
    setCheckout({ productId, deliveryType, qty, territory });
  };

  const confirmPay = async () => {
    if (!checkoutPkg || !checkout || paying) return;
    const area = String(checkout.territory || '').trim();
    const period = String(timeframe || '').trim();
    if (!area || !period) {
      setError('Gebiet und gewünschter Zeitraum sind erforderlich.');
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
      });
      setActiveProductId(checkout.productId);
      setCheckout(null);
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      throw new Error('Zahlungsseite der Bank konnte nicht geöffnet werden.');
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
        setNotice('Zahlung bestätigt. Ihre Anforderung wurde angelegt.');
      } else if (result.outcome === 'failed') {
        setError('Zahlung wurde von der Bank abgelehnt oder abgebrochen.');
      } else {
        setNotice('Zahlung ist bei der Bank noch offen. Bitte später erneut prüfen.');
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
      setError(err.message || 'Rechnung konnte nicht geladen werden.');
    } finally {
      setInvoiceBusyId('');
    }
  };

  return (
    <div className="broker-page">
      <div className="broker-heading broker-billing-heading">
        <div>
          <div className="eyebrow">Abrechnung</div>
          <h1>Pakete &amp; Guthaben</h1>
          <p className="lede">
            Zwei Pakete: Photovoltaik und Wärmepumpe. Wählen Sie Lead oder Termin, Gebiet und Menge.
          </p>
        </div>
      </div>
      <div className="broker-panel broker-simple-status-bar">
        <div className="broker-status-stat">
          <span className="broker-stat-label">Verfügbares Kontingent</span>
          <div className="broker-stat-val">
            <strong>{leadsRemaining} Leads</strong>
            <small>({leadsUsed} zugewiesen von {leadQuota} gebucht)</small>
          </div>
        </div>
        <div className="broker-status-divider" />
        <div className="broker-status-stat">
          <span className="broker-stat-label">Aktives Paket</span>
          <div className="broker-stat-val">
            <strong>{activeProduct?.label || 'Kein Paket gewählt'}</strong>
          </div>
        </div>
        <div className="broker-status-divider" />
        <div className="broker-status-stat broker-status-stat--link">
          <span className="broker-stat-label">Rechnungsadresse</span>
          <Link to="/dashboard/unternehmen" className="broker-status-action">
            <Building2 size={15} aria-hidden="true" />
            <span>Bearbeiten</span>
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
          const unitLabel = deliveryType === 'appointment' ? 'Termin' : 'Lead';
          const unitPlural = deliveryType === 'appointment' ? 'Termine' : 'Leads';
          return (
            <article
              key={product.id}
              className={`broker-panel broker-simple-pkg-card${product.featured ? ' is-featured' : ''}`}
            >
              <div className="broker-simple-pkg-header">
                <div>
                  <span className="broker-simple-scope-tag">
                    {deliveryType === 'appointment' ? 'Termin' : 'Lead'}
                  </span>
                  <h3>{product.title}</h3>
                </div>
                <div className="broker-simple-price-box">
                  <strong>{formatEuroExact(ENERGY_UNIT_CENTS)}</strong>
                  <small>/ {unitLabel}</small>
                </div>
              </div>

              <p className="broker-simple-desc">{product.description}</p>

              <div className="broker-simple-stepper-row broker-energy-pkg-row">
                <span className="broker-simple-row-label">Art</span>
                <div className="broker-energy-delivery-seg" role="tablist" aria-label={`${product.label} Art`}>
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
                  <span className="broker-simple-row-label">Gebiet / Standort</span>
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
                    {editingTerritory[product.id] ? 'Fertig' : 'Ändern'}
                  </button>
                </div>
                {editingTerritory[product.id] ? (
                  <input
                    className="broker-energy-pkg-input"
                    value={territory}
                    onChange={(event) => setTerritory(product.id, event.target.value)}
                    placeholder="z. B. 50667 Köln"
                    aria-label={`${product.label} Gebiet`}
                    autoFocus
                  />
                ) : (
                  <p className="broker-energy-pkg-address">
                    {territory.trim() || businessLabel || 'Noch keine Adresse hinterlegt'}
                  </p>
                )}
              </div>

              <div className="broker-simple-stepper-row">
                <span className="broker-simple-row-label">{unitPlural}-Menge (ab 10)</span>
                <div className="broker-qty-controls">
                  <button type="button" onClick={() => setQty(product.id, qty - LEAD_STEP)} disabled={qty <= MIN_LEADS} aria-label="Weniger">−</button>
                  <input type="number" min={MIN_LEADS} step={LEAD_STEP} value={qty} onChange={(event) => setQty(product.id, event.target.value)} />
                  <button type="button" onClick={() => setQty(product.id, qty + LEAD_STEP)} aria-label="Mehr">+</button>
                </div>
              </div>

              <div className="broker-simple-sum-row">
                <span>Gesamt ({qty} × {formatEuroExact(ENERGY_UNIT_CENTS)}, ohne MwSt.)</span>
                <strong>{formatEuroExact(ENERGY_UNIT_CENTS)}</strong>
              </div>

              <div className="broker-simple-btn-group">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={paying}
                  onClick={() => openCheckout(product.id)}
                >
                  <CreditCard size={15} /> {unitPlural} buchen
                </button>
                {!active ? (
                  <button type="button" className="btn btn-outline" onClick={() => setActiveProductId(product.id)}>Als Standard merken</button>
                ) : (
                  <span className="broker-simple-active-badge"><Check size={13} /> Aktiver Standard</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {checkoutPkg && checkout ? (
        <div
          className="broker-checkout-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget && !paying) setCheckout(null);
          }}
        >
          <div className="broker-checkout-panel broker-simple-modal">
            <div className="broker-simple-modal-head">
              <div>
                <h2>Zahlung bestätigen</h2>
                <p>
                  {checkout.qty} × {checkoutPkg.label}
                  {checkout.territory ? ` · ${checkout.territory}` : ''}
                </p>
              </div>
              <button type="button" className="broker-checkout-close" disabled={paying} onClick={() => setCheckout(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="broker-form-grid">
              <label>
                Gebiet / PLZ
                <input
                  value={checkout.territory}
                  onChange={(event) => setCheckout((prev) => (prev ? { ...prev, territory: event.target.value } : prev))}
                  placeholder="z. B. 50667 oder Köln"
                  required
                />
              </label>
              <label>
                Gewünschter Zeitraum
                <input value={timeframe} onChange={(event) => setTimeframe(event.target.value)} placeholder="z. B. Oktober 2026" required />
              </label>
            </div>
            <div className="broker-simple-sum-row" style={{ marginBottom: '1rem' }}>
              <span>{checkoutPkg.label}</span>
              <strong>{formatEuroExact(checkoutNet)}</strong>
            </div>
            <p className="lede" style={{ marginBottom: '1.25rem' }}>
              Sie werden zur sicheren Zahlungsseite der ProCredit Bank weitergeleitet.
              Kartendaten werden ausschließlich bei der Bank eingegeben.
            </p>
            <div className="broker-checkout-actions">
              <button type="button" className="btn btn-outline" disabled={paying} onClick={() => setCheckout(null)}>Abbrechen</button>
              <button type="button" className="btn btn-primary" disabled={paying} onClick={confirmPay}>
                {paying ? 'Weiterleitung…' : `${formatEuroExact(checkoutNet)} bezahlen`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="broker-panel broker-invoice-panel">
        <div className="broker-panel-header">
          <div>
            <h2>Rechnungen</h2>
            <p>Übersicht Ihrer bisherigen Zahlungen</p>
          </div>
          <Link to="/dashboard/zahlung" className="broker-pipeline-open">
            <span>Alle Zahlungen</span>
            <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>
        {payments.length ? (
          <div className="broker-invoice-table-wrap">
            <table className="broker-invoice-table">
              <thead>
                <tr>
                  <th>Rechnung</th>
                  <th>Datum</th>
                  <th>Paket</th>
                  <th>Zahlung</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Betrag</th>
                  <th className="broker-invoice-actions-col">Aktion</th>
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
                      <small>{invoice.leadCount} {String(invoice.leadType || '').includes('APPOINTMENT') ? 'Termine' : 'Leads'}</small>
                    </td>
                    <td>
                      <span>{formatCardMask(invoice)}</span>
                    </td>
                    <td>
                      <span className={`broker-invoice-status ${invoice.status === 'paid' ? 'is-paid' : 'is-unpaid'}`}>
                        {invoice.status === 'paid' ? 'Bezahlt' : paymentStatusLabel(invoice.status)}
                      </span>
                      {invoice.status === 'pending' ? (
                        <button
                          type="button"
                          className="broker-text-btn"
                          style={{ display: 'block', marginTop: 6 }}
                          disabled={Boolean(syncingId)}
                          onClick={() => handleSyncPending(invoice.id)}
                        >
                          {syncingId === invoice.id ? 'Prüfe…' : 'Status prüfen'}
                        </button>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className="broker-inv-amount">{formatEuroExact(invoice.netCents || invoice.grossCents)}</strong>
                    </td>
                    <td>
                      <div className="broker-invoice-actions">
                        <button
                          type="button"
                          className="broker-invoice-action"
                          title="Rechnung öffnen"
                          aria-label={`Rechnung ${invoice.invoiceNumber} öffnen`}
                          disabled={Boolean(invoiceBusyId)}
                          onClick={() => runInvoiceAction(invoice.id, openPaymentInvoice)}
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          type="button"
                          className="broker-invoice-action"
                          title="Rechnung herunterladen"
                          aria-label={`Rechnung ${invoice.invoiceNumber} herunterladen`}
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
            <p>Noch keine Rechnungen vorhanden.</p>
          </div>
        )}
      </section>
    </div>
  );
}

