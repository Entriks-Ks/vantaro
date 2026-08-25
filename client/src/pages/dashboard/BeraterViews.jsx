import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Check, ChevronDown, Eye, EyeOff, FileText, LayoutGrid, List, Shield, User, Wand2, X } from 'lucide-react';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import AddressMap from '../../components/AddressMap';
import PhoneField, { isValidMobile } from '../../components/PhoneField';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import { geocodeAddress, hasGoogleMapsKey, isInGermany, reverseGeocode } from '../../lib/googleMaps';
import { LEGAL_FORMS, fileToAvatarDataUrl, generatePassword, validatePassword } from '../../lib/profile';
import { firstName, formatDate, formatEuroExact, greeting, initials } from './helpers';
import {
  formatDistance,
  LEAD_STATUSES,
  LEADS,
  PRODUCT_FILTERS,
  leadById,
  statusLabel,
  VIEW_MODES,
} from './leads';
import { MIN_LEAD_PACK, PACKAGES, packageById, packTotalCents } from './packages';

export function BeraterHome() {
  const { user } = useAuth();
  const { purchased, leadStatuses } = useBroker();

  const stats = useMemo(() => {
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s.id, 0]));
    purchased.forEach((lead) => {
      const status = leadStatuses[String(lead.id)] || lead.status || 'neu';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    return {
      total: purchased.length,
      neu: byStatus.neu || 0,
      kontaktiert: byStatus.kontaktiert || 0,
      termin: byStatus.termin || 0,
      abgeschlossen: byStatus.abgeschlossen || 0,
    };
  }, [purchased, leadStatuses]);

  const recent = purchased.slice(0, 5);

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Lead-Übersicht</div>
          <h1>{greeting()}, <em>{firstName(user)}</em></h1>
          <p className="lede">Pipeline und Bestand Ihrer Chancen — ohne Zahlungsfokus.</p>
        </div>
      </div>

      <div className="broker-home-metrics broker-home-metrics--leads">
        <div className="broker-home-metric is-signal">
          <span>Im Bestand</span>
          <strong>{stats.total}</strong>
          <small>Aktive Leads</small>
        </div>
        <div className="broker-home-metric">
          <span>Neu</span>
          <strong>{stats.neu}</strong>
          <small>Noch nicht kontaktiert</small>
        </div>
        <div className="broker-home-metric">
          <span>In Bearbeitung</span>
          <strong>{stats.kontaktiert + stats.termin}</strong>
          <small>{stats.kontaktiert} kontaktiert · {stats.termin} Termin</small>
        </div>
        <div className="broker-home-metric">
          <span>Abgeschlossen</span>
          <strong>{stats.abgeschlossen}</strong>
          <small>Vorgänge beendet</small>
        </div>
      </div>

      <div className="broker-home-actions">
        <Link className="btn btn-primary" to="/dashboard/leads">Zu Meine Leads</Link>
        <Link className="btn btn-outline" to="/dashboard/leads">Kanban öffnen</Link>
      </div>

      <section className="broker-panel broker-home-recent">
        <div className="broker-panel-header">
          <div>
            <h2>Aktuelle Leads</h2>
            <p>Schnellzugriff auf Ihren Bestand</p>
          </div>
          <Link to="/dashboard/leads" className="broker-text-btn">Alle anzeigen</Link>
        </div>
        {recent.length ? (
          <ul className="broker-home-lead-list">
            {recent.map((lead) => (
              <li key={lead.id}>
                <Link to={`/dashboard/leads/${lead.id}`}>
                  <span>
                    <strong>{lead.name}</strong>
                    <small>{lead.product} · {statusLabel(lead.status)}</small>
                  </span>
                  <b className={`broker-status broker-status--${lead.status}`}>{statusLabel(lead.status)}</b>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Leads</strong>
            <p>Zugewiesene Chancen erscheinen hier und unter Meine Leads.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function LeadCard({ lead, onOpen }) {
  return (
    <article
      className="broker-panel broker-lead-card is-clickable"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(lead.id);
        }
      }}
    >
      <div className="broker-lead-top">
        <div>
          <div className="broker-lead-name">{lead.name}</div>
          <div className="broker-lead-address">⌖ {lead.address}</div>
        </div>
        <span className="broker-status">{statusLabel(lead.status)}</span>
      </div>
      <div className="broker-lead-meta">
        <span>{formatDistance(lead.distanceKm)} entfernt</span>
        <span>{lead.product}</span>
        <span>{lead.quality || 'Exklusiv'}</span>
      </div>
      <p className="broker-lead-note">{lead.note}</p>
      <div className="broker-lead-bottom">
        <div className="broker-lead-price">
          {formatEuroExact(lead.priceCents)}
          <span>bezahlt</span>
        </div>
        <span className="broker-muted-action">Details öffnen</span>
      </div>
    </article>
  );
}

function LeadListRow({ lead, onOpen }) {
  return (
    <button type="button" className="broker-list-row" onClick={() => onOpen(lead.id)}>
      <span className="broker-list-name">
        <strong>{lead.name}</strong>
        <small>{lead.address}</small>
      </span>
      <span className="broker-list-meta">{lead.product}</span>
      <span className="broker-list-meta">{lead.quality}</span>
      <span className={`broker-status broker-status--${lead.status}`}>{statusLabel(lead.status)}</span>
      <span className="broker-list-price">{formatEuroExact(lead.priceCents)}</span>
    </button>
  );
}

export function BeraterLeads() {
  const navigate = useNavigate();
  const { purchasedIds, leadStatuses } = useBroker();
  const [product, setProduct] = useState('all');
  const [view, setView] = useState('kanban');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const visible = useMemo(() => (
    LEADS
      .filter((lead) => purchasedIds.includes(lead.id))
      .filter((lead) => product === 'all' || lead.product === product)
      .map((lead) => ({
        ...lead,
        status: leadStatuses[String(lead.id)] || 'neu',
      }))
  ), [product, purchasedIds, leadStatuses]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [product, view]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, page, pageSize]);

  const openLead = (id) => navigate(`/dashboard/leads/${id}`);

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Gekaufte Chancen</div>
          <h1>Meine <em>Leads</em></h1>
          <p className="lede">Kanban oder Liste — klicken Sie einen Lead für alle Details.</p>
        </div>
      </div>

      <div className="broker-filterbar">
        <div className="broker-tabs" role="tablist" aria-label="Ansicht">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={view === mode.id}
              className={view === mode.id ? 'is-active' : undefined}
              onClick={() => setView(mode.id)}
            >
              {mode.id === 'kanban' ? <LayoutGrid size={14} /> : <List size={14} />}
              {mode.label}
            </button>
          ))}
        </div>
        <label htmlFor="productFilter">Produkt</label>
        <select id="productFilter" value={product} onChange={(event) => setProduct(event.target.value)}>
          {PRODUCT_FILTERS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <span className="broker-filter-count">{visible.length} in Ihrem Bestand</span>
      </div>

      {!visible.length ? (
        <div className="broker-panel broker-empty">
          <strong>Noch keine Leads gekauft</strong>
          <p>Sobald Sie eine Chance übernehmen, erscheint sie hier in Ihrem Bestand.</p>
        </div>
      ) : view === 'list' ? (
        <>
          <div className="broker-panel broker-list-panel">
            <div className="broker-list-head" aria-hidden="true">
              <span>Kontakt</span>
              <span>Produkt</span>
              <span>Qualität</span>
              <span>Status</span>
              <span>Preis</span>
            </div>
            <div className="broker-list-body">
              {pageItems.map((lead) => (
                <LeadListRow key={lead.id} lead={lead} onOpen={openLead} />
              ))}
            </div>
          </div>
          {visible.length > pageSize ? (
            <div className="broker-pagination">
              <button
                type="button"
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Zurück
              </button>
              <span>
                Seite {page} von {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Weiter
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="broker-kanban">
          {LEAD_STATUSES.map((column) => {
            const items = visible.filter((lead) => lead.status === column.id);
            return (
              <section key={column.id} className="broker-kanban-column">
                <header>
                  <div>
                    <strong>{column.label}</strong>
                    <small>{column.hint}</small>
                  </div>
                  <span className="broker-count">{items.length}</span>
                </header>
                <div className="broker-kanban-stack">
                  {items.length ? items.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onOpen={openLead} />
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

export function BeraterLeadDetail() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { purchasedIds, leadStatuses, setLeadStatus } = useBroker();
  const lead = leadById(leadId);
  const owned = lead && purchasedIds.includes(lead.id);
  const status = lead ? (leadStatuses[String(lead.id)] || 'neu') : 'neu';
  const pkg = lead ? packageById(lead.packageId) : null;

  if (!lead || !owned) {
    return <Navigate to="/dashboard/leads" replace />;
  }

  return (
    <div className="broker-page">
      <button type="button" className="broker-back" onClick={() => navigate('/dashboard/leads')}>
        <ArrowLeft size={16} />
        Zurück zu Meine Leads
      </button>

      <div className="broker-heading">
        <div>
          <div className="eyebrow">Lead-Details</div>
          <h1>{lead.name}</h1>
          <p className="lede">{lead.type} · {formatDistance(lead.distanceKm)} entfernt</p>
        </div>
        <span className={`broker-status broker-status--lg broker-status--${status}`}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="broker-detail-grid">
        <section className="broker-panel broker-detail-main">
          <h2>Kontaktdaten</h2>
          <dl className="broker-detail-dl">
            <div>
              <dt>Adresse</dt>
              <dd>{lead.address}</dd>
            </div>
            <div>
              <dt>Telefon</dt>
              <dd>
                <a href={`tel:${lead.phone.replace(/\s/g, '')}`}>{lead.phone}</a>
              </dd>
            </div>
            <div>
              <dt>E-Mail</dt>
              <dd>
                <a href={`mailto:${lead.email}`}>{lead.email}</a>
              </dd>
            </div>
            <div>
              <dt>Beruf / Situation</dt>
              <dd>{lead.occupation}</dd>
            </div>
          </dl>

          <h2>Chance</h2>
          <dl className="broker-detail-dl">
            <div>
              <dt>Produkt</dt>
              <dd>{lead.type}</dd>
            </div>
            <div>
              <dt>Qualität</dt>
              <dd>{lead.quality}</dd>
            </div>
            <div>
              <dt>Paket</dt>
              <dd>{pkg?.label || '—'}</dd>
            </div>
            <div>
              <dt>Preis</dt>
              <dd>{formatEuroExact(lead.priceCents)}</dd>
            </div>
          </dl>

          <h2>Hinweis</h2>
          <p className="broker-detail-note">{lead.note}</p>
        </section>

        <aside className="broker-panel broker-detail-side">
          <h2>Bearbeitungsstatus</h2>
          <p>Verschieben Sie den Lead im Pipeline-Status.</p>
          <div className="broker-status-picker">
            {LEAD_STATUSES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={status === option.id ? 'is-active' : undefined}
                onClick={() => setLeadStatus(lead.id, option.id)}
              >
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
          <Link className="btn btn-outline broker-detail-link" to="/dashboard/zahlung">
            Kontingent prüfen
          </Link>
        </aside>
      </div>
    </div>
  );
}


export function BeraterPayments() {
  const { user } = useAuth();
  const {
    invoices,
    activePackageId,
    selectPackage,
    buyLeadPack,
    leadQuota,
    leadsUsed,
    leadsRemaining,
    quotaLabel,
    activePackage,
  } = useBroker();
  const [qtyByPackage, setQtyByPackage] = useState(() => (
    Object.fromEntries(PACKAGES.map((pkg) => [pkg.id, MIN_LEAD_PACK]))
  ));
  const [checkout, setCheckout] = useState(null);
  const [paying, setPaying] = useState(false);

  const progressPct = leadQuota ? Math.min(100, Math.round((leadsUsed / leadQuota) * 100)) : 0;
  const company = user?.profile?.company || '—';
  const billingEmail = user?.email || '—';
  const customerNumber = user?.customerNumber || '—';
  const billingName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || user?.fullName
    || '—';
  const checkoutPkg = checkout ? packageById(checkout.packageId) : null;
  const checkoutQty = checkout?.qty || MIN_LEAD_PACK;
  const checkoutNet = checkoutPkg ? packTotalCents(checkoutPkg, checkoutQty) : 0;
  const checkoutTax = Math.round(checkoutNet * 0.19);
  const checkoutGross = checkoutNet + checkoutTax;

  const setQty = (packageId, next) => {
    const value = Math.max(MIN_LEAD_PACK, Math.round(Number(next) / MIN_LEAD_PACK) * MIN_LEAD_PACK);
    setQtyByPackage((prev) => ({ ...prev, [packageId]: value }));
  };

  const confirmPay = async () => {
    if (!checkoutPkg || paying) return;
    setPaying(true);
    try {
      const result = buyLeadPack(checkout.packageId, checkout.qty);
      if (result?.ok) setCheckout(null);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="broker-page">
      <div className="broker-heading broker-billing-heading">
        <div>
          <div className="eyebrow">Billing</div>
          <h1>Zah<em>lung</em></h1>
          <p className="lede">
            Kontingent, Pläne und Rechnungen — wie in einem professionellen Berater-Billing-Portal.
            Mindestabnahme {MIN_LEAD_PACK} Leads.
          </p>
        </div>
        <Link className="btn btn-outline" to="/dashboard/unternehmen">
          Rechnungsdaten bearbeiten
        </Link>
      </div>

      <div className="broker-billing-summary">
        <article className="broker-panel broker-billing-card">
          <span className="broker-billing-kicker">Nutzung</span>
          <strong className="broker-billing-metric">{quotaLabel}</strong>
          <p>{leadsUsed} zugewiesen · {leadsRemaining} noch verfügbar</p>
          <div className="broker-quota-bar broker-quota-bar--light" aria-hidden="true">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <small>Freie Plätze = bezahlt, noch nicht zugewiesen</small>
        </article>

        <article className="broker-panel broker-billing-card">
          <span className="broker-billing-kicker">Aktueller Plan</span>
          <strong className="broker-billing-metric-text">{activePackage?.label || 'Kein Plan'}</strong>
          <p>{activePackage?.title || 'Wählen Sie ein Paket unten.'}</p>
          <small>Mindestabnahme {MIN_LEAD_PACK} Leads</small>
        </article>

        <article className="broker-panel broker-billing-card">
          <span className="broker-billing-kicker">Rechnung an</span>
          <strong className="broker-billing-metric-text">{company}</strong>
          <p>{billingName}</p>
          <small>{billingEmail} · Kd.-Nr. {customerNumber}</small>
        </article>
      </div>

      <section className="broker-billing-section">
        <div className="broker-billing-section-head">
          <div>
            <h2>Pläne</h2>
            <p>Menge wählen — Checkout wie bei bekannten SaaS-Portalen (Testmodus).</p>
          </div>
        </div>

        <div className="broker-packages">
          {PACKAGES.map((pkg) => {
            const active = activePackageId === pkg.id;
            const qty = qtyByPackage[pkg.id] || MIN_LEAD_PACK;
            const net = packTotalCents(pkg, qty);
            const tax = Math.round(net * 0.19);
            const gross = net + tax;
            return (
              <article
                key={pkg.id}
                className={`broker-package-card${pkg.featured ? ' is-featured' : ''}${active ? ' is-active' : ''}`}
              >
                <div className="broker-package-label">{pkg.label}</div>
                <h2>{pkg.title}</h2>
                <p>{pkg.description}</p>
                <div className="broker-package-rows">
                  <div>
                    <span>Preis / Lead</span>
                    <strong>{formatEuroExact(pkg.packCents)}</strong>
                  </div>
                  <div>
                    <span>Mindestmenge</span>
                    <strong>{MIN_LEAD_PACK} <small>Leads</small></strong>
                  </div>
                </div>

                <label className="broker-qty-field">
                  Menge (ab {MIN_LEAD_PACK}, Schritte von 10)
                  <div className="broker-qty-controls">
                    <button
                      type="button"
                      onClick={() => setQty(pkg.id, qty - MIN_LEAD_PACK)}
                      disabled={qty <= MIN_LEAD_PACK}
                      aria-label="Weniger"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={MIN_LEAD_PACK}
                      step={MIN_LEAD_PACK}
                      value={qty}
                      onChange={(event) => setQty(pkg.id, event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setQty(pkg.id, qty + MIN_LEAD_PACK)}
                      aria-label="Mehr"
                    >
                      +
                    </button>
                  </div>
                </label>

                <div className="broker-checkout-summary">
                  <div><span>Netto</span><strong>{formatEuroExact(net)}</strong></div>
                  <div><span>MwSt. 19%</span><strong>{formatEuroExact(tax)}</strong></div>
                  <div className="is-total"><span>Gesamt</span><strong>{formatEuroExact(gross)}</strong></div>
                </div>

                <div className="broker-package-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setCheckout({ packageId: pkg.id, qty })}
                  >
                    Weiter zur Zahlung · {qty} Leads
                  </button>
                  {!active ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => selectPackage(pkg.id)}
                    >
                      Als Plan setzen
                    </button>
                  ) : (
                    <span className="broker-package-active">Aktiver Plan</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {checkoutPkg ? (
        <div
          className="broker-checkout-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !paying) setCheckout(null);
          }}
        >
          <div className="broker-checkout-panel">
            <div className="broker-checkout-brand">VANTARO · Testmodus</div>
            <h2 id="checkout-title">Zahlung bestätigen</h2>
            <p>
              Sie zahlen <strong>{formatEuroExact(checkoutGross)}</strong> für{' '}
              <strong>{checkoutPkg.label}</strong> ({checkoutQty} Leads).
            </p>
            <dl className="broker-checkout-details">
              <div>
                <dt>Rechnung an</dt>
                <dd>{company}<small>{billingEmail}</small></dd>
              </div>
              <div>
                <dt>Paket</dt>
                <dd>{checkoutPkg.title}</dd>
              </div>
              <div>
                <dt>Netto</dt>
                <dd>{formatEuroExact(checkoutNet)}</dd>
              </div>
              <div>
                <dt>MwSt. 19%</dt>
                <dd>{formatEuroExact(checkoutTax)}</dd>
              </div>
              <div className="is-total">
                <dt>Gesamt</dt>
                <dd>{formatEuroExact(checkoutGross)}</dd>
              </div>
            </dl>
            <p className="broker-checkout-note">
              Testzahlung — erstellt sofort eine bezahlte Rechnung mit Ihren Kontodaten (kein echtes Geld).
            </p>
            <div className="broker-checkout-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={paying}
                onClick={() => setCheckout(null)}
              >
                Zurück
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={paying}
                onClick={confirmPay}
              >
                {paying ? 'Wird gebucht…' : `Jetzt zahlen · ${formatEuroExact(checkoutGross)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="broker-panel broker-invoice-panel">
        <div className="broker-panel-header">
          <div>
            <h2>Rechnungen</h2>
            <p>Bezahlte Rechnungen — PDF-Download folgt in Kürze</p>
          </div>
        </div>

        {invoices.length ? (
          <div className="broker-invoice-table-wrap">
            <table className="broker-invoice-table">
              <thead>
                <tr>
                  <th>Rechnung</th>
                  <th>Datum</th>
                  <th>Beschreibung</th>
                  <th>Status</th>
                  <th>Betrag</th>
                  <th aria-label="Aktion" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const net = Math.abs(invoice.cents || 0);
                  const tax = invoice.taxCents || Math.round(net * 0.19);
                  const gross = net + tax;
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <span className="broker-invoice-id">
                          <FileText size={14} />
                          {invoice.number}
                        </span>
                      </td>
                      <td>{formatDate(invoice.at)}</td>
                      <td>
                        <strong>{invoice.label}</strong>
                        <small>{invoice.leads} Leads</small>
                      </td>
                      <td>
                        <span className="broker-invoice-status is-paid">Paid</span>
                      </td>
                      <td>
                        <strong>{formatEuroExact(gross)}</strong>
                        <small>inkl. MwSt.</small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="broker-invoice-download"
                          disabled
                          title="PDF-Download ist noch nicht verfügbar"
                        >
                          <FileText size={14} />
                          Demnächst
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Rechnungen</strong>
            <p>Nach dem ersten Paketkauf erscheinen Rechnungen hier.</p>
          </div>
        )}
      </section>

      <p className="broker-muted-note">
        Richtwerte zzgl. MwSt. — abhängig von Qualitätsstufe, Region und Vereinbarung.
        Ein Lead ist kein garantierter Abschluss. Bankverbindung und PDF-Download folgen später.
      </p>
    </div>
  );
}


function ProfileNav({ active }) {
  const links = [
    { id: 'profil', to: '/dashboard/profil', label: 'Profil', icon: User },
    { id: 'unternehmen', to: '/dashboard/unternehmen', label: 'Unternehmen', icon: Building2 },
    { id: 'sicherheit', to: '/dashboard/sicherheit', label: 'Sicherheit', icon: Shield },
  ];

  return (
    <nav className="broker-profile-nav" aria-label="Einstellungen">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.id}
            to={link.to}
            className={active === link.id ? 'is-active' : undefined}
          >
            <Icon size={16} strokeWidth={2} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsShell({ active, eyebrow, title, lede, children }) {
  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </div>
      </div>
      <div className="broker-settings-layout">
        <ProfileNav active={active} />
        <div className="broker-settings-main">{children}</div>
      </div>
    </div>
  );
}

function personalForm(user) {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    avatarUrl: user?.avatarUrl || '',
  };
}

function companyForm(user) {
  const business = user?.profile?.businessAddress || {};
  return {
    company: user?.profile?.company || '',
    legalForm: user?.profile?.legalForm || '',
    businessStreet: business.street || '',
    businessZip: business.zip || '',
    businessCity: business.city || '',
    billingSame: true,
    website: user?.profile?.website || '',
  };
}

const LEGAL_FORM_META = {
  GmbH: 'Gesellschaft mit beschränkter Haftung',
  'UG (haftungsbeschränkt)': 'Unternehmergesellschaft',
  AG: 'Aktiengesellschaft',
  'e.K.': 'Eingetragener Kaufmann / Kauffrau',
  GbR: 'Gesellschaft bürgerlichen Rechts',
  OHG: 'Offene Handelsgesellschaft',
  KG: 'Kommanditgesellschaft',
  PartG: 'Partnerschaftsgesellschaft',
  'Freiberufler / Einzelunternehmen': 'Selbstständig ohne Gesellschaft',
  Sonstige: 'Andere Rechtsform',
};

function FieldLabel({ children, required = false }) {
  return (
    <span className="broker-field-caption">
      {children}
      {required ? <span className="broker-req" aria-hidden="true"> *</span> : null}
    </span>
  );
}

function LegalFormSelect({ value, onChange, disabled, required }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = LEGAL_FORMS.includes(value) ? value : '';

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className={`broker-legal-select${open ? ' is-open' : ''}${selected ? ' has-value' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="broker-legal-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="broker-legal-select__value">
          {selected ? (
            <>
              <strong>{selected}</strong>
              <small>{LEGAL_FORM_META[selected]}</small>
            </>
          ) : (
            <span className="broker-legal-select__placeholder">Bitte wählen</span>
          )}
        </span>
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {open ? (
        <ul className="broker-legal-select__menu" role="listbox" aria-label="Rechtsform">
          {LEGAL_FORMS.map((formName) => {
            const isActive = formName === selected;
            return (
              <li key={formName} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  className={isActive ? 'is-active' : undefined}
                  onClick={() => {
                    onChange(formName);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong>{formName}</strong>
                    <small>{LEGAL_FORM_META[formName]}</small>
                  </span>
                  {isActive ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function PasswordToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      className="password-toggle"
      onClick={onToggle}
      aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
    >
      {show ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
    </button>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const { changePassword } = useAuth();
  const { showToast } = useBroker();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setCurrentPassword('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const fillGenerated = () => {
    const next = generatePassword();
    setPassword(next);
    setConfirmPassword(next);
    setShowNew(true);
    setShowConfirm(true);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!currentPassword) {
      setError('Bitte geben Sie Ihr aktuelles Passwort ein.');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, password });
      showToast('Passwort wurde geändert');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="pw-modal-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={onClose} />
      <form className="broker-modal__panel broker-pw-modal" onSubmit={submit}>
        <div className="broker-pw-modal__head">
          <div>
            <h2 id="pw-modal-title">Passwort ändern</h2>
            <p>Geben Sie Ihr aktuelles Passwort ein und wählen Sie ein neues.</p>
          </div>
          <button type="button" className="broker-pw-modal__close" onClick={onClose} aria-label="Schließen">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="broker-pw-modal__body">
          {error ? <div className="broker-alert">{error}</div> : null}

          <label className="broker-pw-field">
            <span>Aktuelles Passwort</span>
            <div className="password-input-wrapper">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={saving}
                required
              />
              <PasswordToggle show={showCurrent} onToggle={() => setShowCurrent((value) => !value)} />
            </div>
          </label>

          <label className="broker-pw-field">
            <span>Neues Passwort</span>
            <div className="password-input-wrapper has-actions">
              <input
                type={showNew ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                disabled={saving}
                required
              />
              <div className="password-input-actions">
                <button
                  type="button"
                  className="password-action"
                  onClick={fillGenerated}
                  disabled={saving}
                  aria-label="Passwort generieren"
                  title="Passwort generieren"
                >
                  <Wand2 size={18} strokeWidth={2} />
                </button>
                <PasswordToggle show={showNew} onToggle={() => setShowNew((value) => !value)} />
              </div>
            </div>
            <small className="broker-pw-hint">Mindestens 8 Zeichen.</small>
          </label>

          <label className="broker-pw-field">
            <span>Passwort bestätigen</span>
            <div className="password-input-wrapper">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={saving}
                required
              />
              <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm((value) => !value)} />
            </div>
          </label>
        </div>

        <div className="broker-pw-modal__footer">
          <button type="button" className="broker-pw-btn broker-pw-btn--ghost" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" className="broker-pw-btn broker-pw-btn--primary" disabled={saving}>
            {saving ? 'Wird gespeichert…' : 'Passwort ändern'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Persönliche Daten: Bild, Name, E-Mail, Telefon */
export function BeraterProfile() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState(() => personalForm(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarName, setAvatarName] = useState('');

  useEffect(() => {
    setForm(personalForm(user));
    setAvatarName('');
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      setForm((prev) => ({ ...prev, avatarUrl }));
      setAvatarName(file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.firstName.trim() || form.firstName.trim().length < 2) {
      setError('Bitte geben Sie Ihren Vornamen an.');
      return;
    }
    if (!form.lastName.trim() || form.lastName.trim().length < 2) {
      setError('Bitte geben Sie Ihren Nachnamen an.');
      return;
    }
    if (!isValidMobile(form.phone)) {
      setError('Bitte geben Sie eine gültige Telefonnummer an.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(form);
      setAvatarName('');
      showToast('Persönliche Daten gespeichert');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      active="profil"
      eyebrow="Einstellungen"
      title={<>Pro<em>fil</em></>}
      lede="Ihre persönlichen Daten: Bild, Name, E-Mail und Telefonnummer."
    >
      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <h2>Persönliche Daten</h2>
        {error && <div className="broker-alert">{error}</div>}

        <div className="broker-avatar-edit">
          <div className="broker-avatar broker-avatar--xl" aria-hidden="true">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" />
            ) : (
              initials({ firstName: form.firstName, lastName: form.lastName, email: user?.email })
            )}
          </div>
          <div>
            <span className="broker-field-label">Profilbild</span>
            <label className="broker-file-btn" htmlFor="profile-avatar">
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatar}
                disabled={saving}
              />
              <span>Bild auswählen</span>
              <small>{avatarName || (form.avatarUrl ? 'Aktuelles Bild behalten' : 'Optional')}</small>
            </label>
            {form.avatarUrl ? (
              <button
                type="button"
                className="broker-text-btn"
                onClick={() => {
                  setForm((prev) => ({ ...prev, avatarUrl: '' }));
                  setAvatarName('');
                }}
                disabled={saving}
              >
                Bild entfernen
              </button>
            ) : null}
          </div>
        </div>

        <div className="broker-form-grid">
          <label>
            <FieldLabel required>Vorname</FieldLabel>
            <input
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              autoComplete="given-name"
              disabled={saving}
              required
            />
          </label>
          <label>
            <FieldLabel required>Nachname</FieldLabel>
            <input
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              disabled={saving}
              required
            />
          </label>
          <label className="is-full">
            <FieldLabel>E-Mail-Adresse</FieldLabel>
            <input type="email" value={user?.email || ''} autoComplete="email" disabled />
          </label>
          <label className="is-full">
            <FieldLabel required>Telefonnummer</FieldLabel>
            <PhoneField
              id="profile-phone"
              value={form.phone}
              onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
              disabled={saving}
              required
              className="vantaro-phone-input--light"
            />
          </label>
        </div>

        <button type="submit" className="btn btn-primary broker-save" disabled={saving}>
          {saving ? 'Wird gespeichert…' : 'Profil speichern'}
        </button>
      </form>
    </SettingsShell>
  );
}

export function BeraterCompany() {
  const { user, updateProfile, isAdmin } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState(() => companyForm(user));
  const [mapPin, setMapPin] = useState({ lat: null, lng: null });
  const [mapNotice, setMapNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const needsPhone = !String(user?.phone || '').trim();
  const req = !isAdmin;
  const skipGeocodeRef = useRef(false);

  useEffect(() => {
    setForm(companyForm(user));
  }, [user]);

  useEffect(() => {
    if (!hasGoogleMapsKey()) return undefined;
    if (skipGeocodeRef.current) {
      skipGeocodeRef.current = false;
      return undefined;
    }

    const street = form.businessStreet.trim();
    const zip = form.businessZip.trim();
    const city = form.businessCity.trim();
    // City alone is enough to show a pin (e.g. Augsburg); street+zip refine it
    if (!city && !(street && zip)) {
      setMapPin({ lat: null, lng: null });
      return undefined;
    }

    const query = [street, zip, city, 'Deutschland'].filter(Boolean).join(', ');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      geocodeAddress(query)
        .then((coords) => {
          if (!cancelled && coords) {
            setMapPin(coords);
            setMapNotice('');
          }
        })
        .catch((err) => {
          if (!cancelled) setMapNotice(err?.message || 'Geocoding fehlgeschlagen.');
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.businessStreet, form.businessZip, form.businessCity]);

  const applyPlaceToForm = ({ street, zip, city, lat, lng }) => {
    skipGeocodeRef.current = Number.isFinite(lat) && Number.isFinite(lng);
    setForm((prev) => ({
      ...prev,
      businessStreet: street ?? prev.businessStreet,
      businessZip: zip || prev.businessZip,
      businessCity: city || prev.businessCity,
    }));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMapPin({ lat, lng });
    }
  };

  const handleMapPick = async ({ lat, lng }) => {
    if (!isInGermany(lat, lng)) {
      setMapNotice('Nur Standorte in Deutschland — Österreich ist nicht erlaubt.');
      return;
    }

    const previousPin = mapPin;
    setMapNotice('Adresse wird ermittelt…');

    try {
      const place = await reverseGeocode(lat, lng);
      if (!place) {
        setMapNotice('Keine Adresse an diesem Punkt gefunden.');
        return;
      }
      if (!place.inGermany) {
        setMapPin(previousPin);
        setMapNotice('Nur Standorte in Deutschland — Österreich und andere Länder sind nicht erlaubt.');
        return;
      }
      applyPlaceToForm(place);
      setMapNotice('');
    } catch (err) {
      setMapPin(previousPin);
      setMapNotice(err?.message || 'Geocoding fehlgeschlagen.');
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');

    if (!isAdmin) {
      if (needsPhone) {
        setError('Bitte hinterlegen Sie zuerst Ihre Telefonnummer unter Profil.');
        return;
      }
      if (!form.company.trim() || !form.legalForm) {
        setError('Firmenname und Rechtsform sind erforderlich.');
        return;
      }
      if (!form.businessStreet.trim() || !form.businessZip.trim() || !form.businessCity.trim()) {
        setError('Bitte geben Sie die vollständige Geschäftsadresse an.');
        return;
      }
    }

    setSaving(true);
    try {
      await updateProfile({ ...form, billingSame: true });
      showToast('Unternehmensdaten gespeichert');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      active="unternehmen"
      eyebrow="Einstellungen"
      title={<>Unterneh<em>men</em></>}
      lede={
        isAdmin
          ? 'Admin-Konto: Unternehmensdaten sind optional.'
          : user?.onboardingComplete
            ? 'Firma, Rechtsform und Adressen für Ihr Maklerkonto.'
            : 'Ergänzen Sie Firma und Adresse — danach ist Ihr Konto vollständig.'
      }
    >
      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <div className="broker-settings-head">
          <div>
            <h2>Unternehmensdaten{isAdmin ? ' (optional)' : ''}</h2>
            <p className="broker-muted-note">
              Angaben für Vertrag, Rechnungen und Verifizierung im Portal.
            </p>
          </div>
          {user?.customerNumber ? (
            <p className="broker-customer-chip">
              <span>Kundennummer</span>
              <strong>{user.customerNumber}</strong>
            </p>
          ) : null}
        </div>

        {error && <div className="broker-alert">{error}</div>}

        {!isAdmin && needsPhone ? (
          <div className="broker-inline-hint">
            <p>Telefonnummer fehlt noch im Profil — bitte zuerst ergänzen.</p>
            <Link to="/dashboard/profil" className="broker-text-btn">
              Zum Profil
            </Link>
          </div>
        ) : null}

        <section className="broker-settings-section">
          <header>
            <h3>Firma</h3>
            <p>Name und Rechtsform für Dokumente und Anzeige.</p>
          </header>
          <div className="broker-form-grid">
            <label className="is-full">
              <FieldLabel required={req}>Firmenname</FieldLabel>
              <input
                name="company"
                value={form.company}
                onChange={handleChange}
                autoComplete="organization"
                placeholder="z. B. Muster Finanzberatung"
                disabled={saving}
                required={req}
              />
            </label>
            <div className="is-full broker-field">
              <FieldLabel required={req}>Rechtsform</FieldLabel>
              <LegalFormSelect
                value={form.legalForm}
                onChange={(legalForm) => setForm((prev) => ({ ...prev, legalForm }))}
                disabled={saving}
                required={req}
              />
            </div>
          </div>
        </section>

        <section className="broker-settings-section">
          <header>
            <h3>Geschäftsadresse</h3>
            <p>Sitz Ihres Unternehmens — Suche nutzen oder Pin auf der Karte setzen.</p>
          </header>
          <div className="broker-form-grid">
            <label className="is-full">
              <FieldLabel required={req}>Straße und Hausnummer</FieldLabel>
              <AddressAutocomplete
                name="businessStreet"
                value={form.businessStreet}
                onChange={(businessStreet) => setForm((prev) => ({ ...prev, businessStreet }))}
                onPlaceSelect={(place) => {
                  applyPlaceToForm(place);
                  setMapNotice('');
                }}
                autoComplete="street-address"
                placeholder="z. B. Augsburg oder Straße, Hausnummer"
                disabled={saving}
                required={req}
              />
            </label>
            <label>
              <FieldLabel required={req}>PLZ</FieldLabel>
              <input
                name="businessZip"
                value={form.businessZip}
                onChange={handleChange}
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="12345"
                disabled={saving}
                required={req}
              />
            </label>
            <label>
              <FieldLabel required={req}>Ort</FieldLabel>
              <input
                name="businessCity"
                value={form.businessCity}
                onChange={handleChange}
                autoComplete="address-level2"
                placeholder="Berlin"
                disabled={saving}
                required={req}
              />
            </label>
            {hasGoogleMapsKey() ? (
              <div className="is-full">
                <AddressMap
                  lat={mapPin.lat}
                  lng={mapPin.lng}
                  onMapClick={handleMapPick}
                />
                {mapNotice ? (
                  <p className="broker-address-map-note">{mapNotice}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="broker-settings-section">
          <header>
            <h3>Online <span className="broker-optional">(optional)</span></h3>
            <p>Website Ihres Unternehmens — ohne https:// möglich.</p>
          </header>
          <div className="broker-form-grid">
            <label className="is-full">
              <FieldLabel>Website</FieldLabel>
              <input
                name="website"
                type="text"
                inputMode="url"
                value={form.website}
                onChange={handleChange}
                autoComplete="url"
                placeholder="www.beispiel.de"
                disabled={saving}
              />
            </label>
          </div>
        </section>

        <button type="submit" className="btn btn-primary broker-save" disabled={saving}>
          {saving ? 'Wird gespeichert…' : 'Unternehmen speichern'}
        </button>
      </form>
    </SettingsShell>
  );
}

export function BeraterSecurity() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <SettingsShell
      active="sicherheit"
      eyebrow="Einstellungen"
      title={<>Sicher<em>heit</em></>}
      lede="Passwort ändern — mit aktuellem Passwort und starken Regeln."
    >
      <section className="broker-panel broker-settings broker-settings--wide">
        <h2>Passwort</h2>
        <p className="broker-muted-note" style={{ marginTop: 8 }}>
          Mindestens 8 Zeichen, Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.
        </p>
        <button type="button" className="btn btn-primary broker-save" onClick={() => setModalOpen(true)}>
          Passwort ändern
        </button>
      </section>

      <ChangePasswordModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </SettingsShell>
  );
}
