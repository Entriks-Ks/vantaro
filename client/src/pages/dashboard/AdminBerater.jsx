import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ClipboardList,
  CreditCard,
  Globe,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Users,
} from 'lucide-react';
import {
  fetchBeraterPipeline,
  fetchBeraterPipelines,
  leadTypeLabel,
  requestStatusLabel,
  requestStatusTone,
} from '../../lib/berater';
import { statusLabel as leadStatusLabel } from '../../lib/leads';
import { leadScopeLabel } from '../../lib/scopes';
import { formatCardMask } from '../../lib/payments';
import { DashSeg } from './DashboardLayout';
import { formatDate, formatEuro, formatEuroExact } from './helpers';

const VIEW_TABS = [
  { id: 'details', label: 'Details', icon: UserRound },
  { id: 'requests', label: 'Anfragen', icon: ClipboardList },
  { id: 'payment', label: 'Zahlungen', icon: CreditCard },
  { id: 'leads', label: 'Leads', icon: Users },
];

const PAY_SEGMENT_COLORS = ['#ff8b73', '#56d3c4', '#7eb6ff', '#f0c36a'];
const LEAD_STATUS_COLORS = {
  neu: '#7eb6ff',
  zugewiesen: '#56d3c4',
  in_bearbeitung: '#f0c36a',
  erledigt: '#9aa8bc',
};

function beraterInitials(user) {
  const name = String(user?.fullName || '').trim();
  if (name) {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'B';
  }
  return String(user?.email || 'B').slice(0, 2).toUpperCase();
}

function BeraterAvatar({ berater, size = 'sm' }) {
  const src = String(berater?.avatarUrl || '').trim();
  return (
    <span
      className={`dash-lead-avatar dash-lead-avatar--${size}${src ? ' has-photo' : ''}`}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : beraterInitials(berater)}
    </span>
  );
}

function progressPercent(request) {
  if (!request?.requestedCount) return 0;
  return Math.min(100, Math.round((request.validCount / request.requestedCount) * 100));
}

function isActiveRequest(request) {
  return request?.status === 'active' || request?.status === 'pending';
}

function isCompletedRequest(request) {
  return request?.status === 'completed';
}

function PipelineStatus({ request }) {
  if (!request) {
    return <span className="dash-badge dash-badge--muted">Kein Auftrag</span>;
  }
  return (
    <span className={`dash-badge dash-badge--${requestStatusTone(request.status)}`}>
      {requestStatusLabel(request.status)}
    </span>
  );
}

function leadTone(status) {
  if (status === 'zugewiesen') return 'ok';
  if (status === 'erledigt') return 'muted';
  if (status === 'in_bearbeitung') return 'warn';
  return 'new';
}

function formatProfileAddress(address) {
  if (!address) return null;
  const street = String(address.street || '').trim();
  const cityLine = [address.zip, address.city].filter(Boolean).join(' ').trim();
  if (!street && !cityLine) return null;
  return { street, cityLine };
}

function AnimatedNumber({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{display}</>;
}

function StatusDonut({ label, value, total, tone = 'live', hint }) {
  const target = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    setPercent(0);
    const frame = requestAnimationFrame(() => setPercent(target));
    return () => cancelAnimationFrame(frame);
  }, [target, value, total]);

  const size = 112;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - percent / 100);

  return (
    <div className={`dash-bv-donut is-${tone}`}>
      <div className="dash-bv-donut__ring" aria-hidden="true">
        <svg viewBox={`0 0 ${size} ${size}`}>
          <circle className="dash-bv-donut__track" cx={size / 2} cy={size / 2} r={radius} />
          <circle
            className="dash-bv-donut__fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="dash-bv-donut__center">
          <strong>{value}</strong>
          <span>{percent}%</span>
        </div>
      </div>
      <div className="dash-bv-donut__copy">
        <b>{label}</b>
        <small>{hint || `${value} von ${total}`}</small>
      </div>
    </div>
  );
}

function CompositionDonut({ segments, centerLabel, centerValue }) {
  const size = 132;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments.reduce((sum, entry) => sum + entry.value, 0);
  let cursor = 0;

  return (
    <div className="dash-bv-composition">
      <div className="dash-bv-composition__ring" aria-hidden="true">
        <svg viewBox={`0 0 ${size} ${size}`}>
          <circle className="dash-bv-composition__track" cx={size / 2} cy={size / 2} r={radius} />
          {total > 0
            ? segments.map((entry, index) => {
              const length = (entry.value / total) * circ;
              const offset = circ * 0.25 - cursor;
              cursor += length;
              return (
                <circle
                  key={entry.id}
                  className="dash-bv-composition__seg"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={entry.color || PAY_SEGMENT_COLORS[index % PAY_SEGMENT_COLORS.length]}
                  strokeDasharray={`${length} ${Math.max(0, circ - length)}`}
                  strokeDashoffset={offset}
                />
              );
            })
            : null}
        </svg>
        <div className="dash-bv-composition__center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="dash-bv-composition__legend">
        {segments.map((entry, index) => (
          <li key={entry.id}>
            <i style={{ background: entry.color || PAY_SEGMENT_COLORS[index % PAY_SEGMENT_COLORS.length] }} />
            <span>{entry.label}</span>
            <b>{entry.display}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressBars({ items }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="dash-bv-bars" role="list">
      {items.map((item) => {
        const width = Math.max(4, Math.round((item.value / max) * 100));
        return (
          <div key={item.id} className="dash-bv-bars__row" role="listitem">
            <div className="dash-bv-bars__label">
              <span>{item.label}</span>
              <b>{item.display ?? item.value}</b>
            </div>
            <span className="dash-bv-bars__track" aria-hidden="true">
              <span
                className="dash-bv-bars__fill"
                style={{
                  width: `${width}%`,
                  background: item.color || 'linear-gradient(90deg, #37cdc0, #7eb6ff)',
                }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProfileFact({ icon: Icon, label, children }) {
  const empty = children == null || children === '';
  return (
    <div className={`dash-bv-fact${empty ? ' is-empty' : ''}`}>
      <span className="dash-bv-fact__icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="dash-bv-fact__copy">
        <span>{label}</span>
        <strong>{empty ? 'Nicht hinterlegt' : children}</strong>
      </div>
    </div>
  );
}

function DetailsPanel({ berater, totals, requestCount, assignedCount, payments }) {
  const profile = berater.profile || {};
  const business = formatProfileAddress(profile.businessAddress);
  const billing = formatProfileAddress(profile.billingAddress);
  const billingSame = profile.billingSame !== false;
  const products = Array.isArray(profile.products) ? profile.products.filter(Boolean) : [];
  const website = String(profile.website || '').trim();
  const websiteHref = website
    ? (/^https?:\/\//i.test(website) ? website : `https://${website}`)
    : '';
  const phone = String(berater.phone || '').trim();
  const company = berater.company || profile.company || '';
  const paid = (payments || []).filter((entry) => entry.status === 'paid');
  const grossTotal = paid.reduce((sum, entry) => sum + (Number(entry.grossCents) || 0), 0);

  return (
    <div className="dash-bv-panel dash-bv-panel--details">
      <div className="dash-bv-overview">
        <article className="dash-bv-stat">
          <span>Anfragen</span>
          <strong><AnimatedNumber value={requestCount} /></strong>
          <small>{totals.requested} Leads angefragt</small>
        </article>
        <article className="dash-bv-stat">
          <span>Gültig geliefert</span>
          <strong><AnimatedNumber value={totals.valid} /></strong>
          <small>{totals.remaining} noch offen</small>
        </article>
        <article className="dash-bv-stat">
          <span>Lead-Bestand</span>
          <strong><AnimatedNumber value={assignedCount} /></strong>
          <small>{totals.refunded} erstattet</small>
        </article>
        <article className="dash-bv-stat is-accent">
          <span>Umsatz</span>
          <strong>{formatEuro(grossTotal)}</strong>
          <small>{paid.length} Zahlung{paid.length === 1 ? '' : 'en'}</small>
        </article>
      </div>

      <div className="dash-bv-profile-grid">
        <section className="dash-bv-card">
          <header>
            <UserRound size={16} aria-hidden="true" />
            <h3>Kontakt</h3>
          </header>
          <div className="dash-bv-facts">
            <ProfileFact icon={Mail} label="E-Mail">
              {berater.email ? <a href={`mailto:${berater.email}`}>{berater.email}</a> : null}
            </ProfileFact>
            <ProfileFact icon={Phone} label="Telefon">
              {phone ? <a href={`tel:${phone}`}>{phone}</a> : null}
            </ProfileFact>
            <ProfileFact icon={UserRound} label="Name">
              {berater.fullName}
            </ProfileFact>
          </div>
        </section>

        <section className="dash-bv-card">
          <header>
            <Building2 size={16} aria-hidden="true" />
            <h3>Unternehmen</h3>
          </header>
          <div className="dash-bv-facts">
            <ProfileFact icon={Building2} label="Firma">
              {[company, profile.legalForm].filter(Boolean).join(' · ')}
            </ProfileFact>
            <ProfileFact icon={Globe} label="Website">
              {websiteHref ? (
                <a href={websiteHref} target="_blank" rel="noreferrer">
                  {website.replace(/^https?:\/\//i, '')}
                </a>
              ) : null}
            </ProfileFact>
            <ProfileFact icon={MapPin} label="Einsatzgebiet">
              {[profile.location, profile.radiusKm ? `Umkreis ${profile.radiusKm} km` : '']
                .filter(Boolean)
                .join(' · ')}
            </ProfileFact>
          </div>
          {products.length ? (
            <div className="dash-bv-chips" aria-label="Produkte">
              {products.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="dash-bv-card">
          <header>
            <MapPin size={16} aria-hidden="true" />
            <h3>Adressen</h3>
          </header>
          <div className="dash-bv-addresses">
            <div>
              <span>Geschäftsadresse</span>
              {business ? (
                <strong>
                  {business.street ? <>{business.street}<br /></> : null}
                  {business.cityLine}
                </strong>
              ) : (
                <strong className="is-empty">Nicht hinterlegt</strong>
              )}
            </div>
            <div>
              <span>Rechnungsadresse</span>
              {billingSame && business ? (
                <strong>Identisch mit Geschäftsadresse</strong>
              ) : billing ? (
                <strong>
                  {billing.street ? <>{billing.street}<br /></> : null}
                  {billing.cityLine}
                </strong>
              ) : (
                <strong className="is-empty">Nicht hinterlegt</strong>
              )}
            </div>
          </div>
        </section>

        <section className="dash-bv-card">
          <header>
            <BadgeCheck size={16} aria-hidden="true" />
            <h3>Konto</h3>
          </header>
          <div className="dash-bv-facts">
            <ProfileFact icon={BadgeCheck} label="Kundennummer">
              {berater.customerNumber}
            </ProfileFact>
            <ProfileFact icon={UserRound} label="Registriert">
              {formatDate(berater.createdAt)}
            </ProfileFact>
            <ProfileFact icon={Mail} label="Verifizierung">
              {berater.verified ? 'E-Mail verifiziert' : 'Nicht verifiziert'}
            </ProfileFact>
            <ProfileFact icon={BadgeCheck} label="Onboarding">
              {berater.onboardingComplete ? 'Profil vollständig' : 'Profil unvollständig'}
            </ProfileFact>
          </div>
        </section>
      </div>
    </div>
  );
}

function RequestsPanel({ requests, totals }) {
  const requestCount = requests.length;
  const activeRequestCount = requests.filter((entry) => isActiveRequest(entry)).length;
  const completedRequestCount = requests.filter((entry) => isCompletedRequest(entry)).length;
  const pausedCount = requests.filter((entry) => entry.status === 'cancelled').length;
  const rejectedCount = requests.filter((entry) => entry.status === 'rejected').length;
  const fulfillment = totals.requested
    ? Math.min(100, Math.round((totals.valid / totals.requested) * 100))
    : 0;

  const typeBars = useMemo(() => {
    const map = new Map();
    for (const entry of requests) {
      const key = entry.leadType || 'PKV';
      const current = map.get(key) || { id: key, label: leadTypeLabel(key), value: 0 };
      current.value += Number(entry.requestedCount) || 0;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [requests]);

  if (!requests.length) {
    return (
      <div className="dash-bv-panel">
        <div className="dash-empty">
          <p>Dieser Berater hat noch keine Lead-Anfragen gestellt.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-bv-panel dash-bv-panel--requests">
      <div className="dash-bv-metrics">
        <div className="dash-metric">
          <span>Anfragen</span>
          <strong><AnimatedNumber value={requestCount} /></strong>
          <small>{activeRequestCount} aktiv</small>
        </div>
        <div className="dash-metric">
          <span>Angefragt</span>
          <strong><AnimatedNumber value={totals.requested} /></strong>
          <small>{totals.remaining} offen</small>
        </div>
        <div className="dash-metric">
          <span>Gültig</span>
          <strong><AnimatedNumber value={totals.valid} /></strong>
          <small>{fulfillment}% erfüllt</small>
        </div>
        <div className="dash-metric">
          <span>Erstattet</span>
          <strong><AnimatedNumber value={totals.refunded} /></strong>
          <small>über alle Anfragen</small>
        </div>
      </div>

      <div className="dash-bv-charts">
        <section className="dash-bv-card">
          <header>
            <div>
              <h3>Statusverteilung</h3>
              <p>Anteil aktiver und erfüllter Anfragen</p>
            </div>
          </header>
          <div className="dash-bv-donut-row">
            <StatusDonut
              label="Aktiv"
              value={activeRequestCount}
              total={requestCount}
              tone="live"
              hint={`${activeRequestCount} aktive Anfrage${activeRequestCount === 1 ? '' : 'n'}`}
            />
            <StatusDonut
              label="Erfüllt"
              value={completedRequestCount}
              total={requestCount}
              tone="done"
              hint={`${completedRequestCount} erfüllt`}
            />
          </div>
          {(pausedCount || rejectedCount) ? (
            <div className="dash-bv-inline-stats">
              {pausedCount ? <span>{pausedCount} pausiert</span> : null}
              {rejectedCount ? <span>{rejectedCount} abgelehnt</span> : null}
            </div>
          ) : null}
        </section>

        <section className="dash-bv-card">
          <header>
            <div>
              <h3>Erfüllung</h3>
              <p>Gültige Leads vs. angefragte Menge</p>
            </div>
          </header>
          <div className="dash-bv-fulfill">
            <div className="dash-bv-fulfill__head">
              <strong>{fulfillment}%</strong>
              <span>{totals.valid} / {totals.requested}</span>
            </div>
            <span className="dash-bv-fulfill__track" aria-hidden="true">
              <span style={{ width: `${fulfillment}%` }} />
            </span>
          </div>
          {typeBars.length ? (
            <>
              <h4 className="dash-bv-subhead">Nach Lead-Typ</h4>
              <ProgressBars items={typeBars} />
            </>
          ) : null}
        </section>
      </div>

      <section className="dash-bv-card dash-bv-card--list">
        <header>
          <div>
            <h3>Alle Anfragen</h3>
            <p>{requestCount} Einträge · neueste zuerst</p>
          </div>
        </header>
        <div className="dash-bv-request-list">
          {requests.map((entry) => {
            const percent = progressPercent(entry);
            return (
              <article key={entry.id} className="dash-bv-request">
                <div className="dash-bv-request__main">
                  <div className="dash-bv-request__title">
                    <strong>{entry.code || 'Ohne Code'}</strong>
                    <PipelineStatus request={entry} />
                  </div>
                  <span>
                    {leadScopeLabel(entry.scope)} · {leadTypeLabel(entry.leadType)} · {entry.requestedCount} Leads
                  </span>
                  <span className="dash-bv-request__meta">
                    {entry.validCount} gültig · {entry.remaining} offen
                    {entry.refundedCount ? ` · ${entry.refundedCount} erstattet` : ''}
                    {' · '}{formatDate(entry.createdAt)}
                  </span>
                </div>
                <div className="dash-bv-request__side">
                  <div className="dash-bv-request__pct">
                    <b>{percent}%</b>
                    <small>Fortschritt</small>
                  </div>
                  <Link
                    className="dash-bv-link"
                    to={`/dashboard/anfordern/${entry.id}`}
                  >
                    Anfrage ansehen
                  </Link>
                </div>
                <span className="dash-bv-request__bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </span>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PaymentPanel({ payments }) {
  const paid = useMemo(
    () => (payments || []).filter((entry) => entry.status === 'paid'),
    [payments],
  );
  const grossTotal = paid.reduce((sum, entry) => sum + (Number(entry.grossCents) || 0), 0);
  const taxTotal = paid.reduce((sum, entry) => sum + (Number(entry.taxCents) || 0), 0);
  const netTotal = paid.reduce((sum, entry) => sum + (Number(entry.netCents) || 0), 0);
  const leadTotal = paid.reduce((sum, entry) => sum + (Number(entry.leadCount) || 0), 0);
  const avgOrder = paid.length ? Math.round(grossTotal / paid.length) : 0;

  const byType = useMemo(() => {
    const map = new Map();
    for (const entry of paid) {
      const key = entry.leadType || 'PKV';
      const current = map.get(key) || { id: key, label: leadTypeLabel(key), value: 0 };
      current.value += Number(entry.grossCents) || 0;
      map.set(key, current);
    }
    return [...map.values()]
      .sort((a, b) => b.value - a.value)
      .map((entry) => ({
        ...entry,
        display: formatEuroExact(entry.value),
      }));
  }, [paid]);

  const byMonth = useMemo(() => {
    const map = new Map();
    for (const entry of paid) {
      const date = new Date(entry.paidAt || entry.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
      const current = map.get(key) || { id: key, label, value: 0 };
      current.value += Number(entry.grossCents) || 0;
      map.set(key, current);
    }
    return [...map.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(-6)
      .map((entry) => ({
        ...entry,
        display: formatEuro(entry.value),
        color: 'linear-gradient(90deg, rgba(55, 205, 192, .85), rgba(126, 182, 255, .9))',
      }));
  }, [paid]);

  if (!paid.length) {
    return (
      <div className="dash-bv-panel">
        <div className="dash-empty">
          <p>Für diesen Berater liegen noch keine Zahlungen vor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-bv-panel dash-bv-panel--payment">
      <div className="dash-bv-pay-hero">
        <div>
          <span>Gesamtumsatz</span>
          <strong>{formatEuroExact(grossTotal)}</strong>
          <small>Netto {formatEuroExact(netTotal)} · MwSt. {formatEuroExact(taxTotal)}</small>
        </div>
        <div className="dash-bv-pay-hero__stats">
          <div>
            <span>Zahlungen</span>
            <b><AnimatedNumber value={paid.length} /></b>
          </div>
          <div>
            <span>Leads gekauft</span>
            <b><AnimatedNumber value={leadTotal} /></b>
          </div>
          <div>
            <span>Ø Betrag</span>
            <b>{formatEuroExact(avgOrder)}</b>
          </div>
        </div>
      </div>

      <div className="dash-bv-charts">
        <section className="dash-bv-card">
          <header>
            <div>
              <h3>Umsatz nach Typ</h3>
              <p>Anteil am Gesamtvolumen</p>
            </div>
          </header>
          <CompositionDonut
            segments={byType}
            centerValue={formatEuro(grossTotal)}
            centerLabel="Umsatz"
          />
        </section>

        <section className="dash-bv-card">
          <header>
            <div>
              <h3>Monatlicher Verlauf</h3>
              <p>Letzte Zahlungsmonate</p>
            </div>
          </header>
          {byMonth.length ? (
            <ProgressBars items={byMonth} />
          ) : (
            <div className="dash-empty"><p>Noch kein Monatsverlauf verfügbar.</p></div>
          )}
        </section>
      </div>

      <section className="dash-bv-card dash-bv-card--list">
        <header>
          <div>
            <h3>Zahlungsverlauf</h3>
            <p>{paid.length} Zahlung{paid.length === 1 ? '' : 'en'}</p>
          </div>
        </header>
        <div className="dash-bv-pay-list">
          {paid.map((entry) => (
            <article key={entry.id} className="dash-bv-pay-row">
              <div>
                <strong>{entry.invoiceNumber || 'Rechnung'}</strong>
                <span>
                  {leadTypeLabel(entry.leadType)} · {entry.leadCount} Leads · {formatCardMask(entry)}
                  {entry.testMode ? ' · Test' : ''}
                </span>
              </div>
              <div className="dash-bv-pay-row__side">
                <b>{formatEuroExact(entry.grossCents)}</b>
                <small>{formatDate(entry.paidAt || entry.createdAt)}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function LeadsPanel({ leads, assignedCount }) {
  const [filter, setFilter] = useState('all');
  const list = leads || [];

  const counts = useMemo(() => {
    const active = list.filter((lead) => !lead.refundedAt).length;
    const refunded = list.filter((lead) => lead.refundedAt).length;
    const byStatus = new Map();
    for (const lead of list) {
      if (lead.refundedAt) continue;
      const key = lead.status || 'neu';
      byStatus.set(key, (byStatus.get(key) || 0) + 1);
    }
    return { active, refunded, byStatus };
  }, [list]);

  const statusBars = useMemo(() => (
    [...counts.byStatus.entries()]
      .map(([id, value]) => ({
        id,
        label: leadStatusLabel(id),
        value,
        color: LEAD_STATUS_COLORS[id] || '#7eb6ff',
      }))
      .sort((a, b) => b.value - a.value)
  ), [counts]);

  const visible = useMemo(() => {
    if (filter === 'active') return list.filter((lead) => !lead.refundedAt);
    if (filter === 'refunded') return list.filter((lead) => lead.refundedAt);
    return list;
  }, [list, filter]);

  if (!list.length) {
    return (
      <div className="dash-bv-panel">
        <div className="dash-empty">
          <p>Diesem Berater wurden noch keine Leads zugewiesen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-bv-panel dash-bv-panel--leads">
      <div className="dash-bv-metrics">
        <div className="dash-metric">
          <span>Bestand</span>
          <strong><AnimatedNumber value={assignedCount || counts.active} /></strong>
          <small>aktive Leads</small>
        </div>
        <div className="dash-metric">
          <span>Gesamt</span>
          <strong><AnimatedNumber value={list.length} /></strong>
          <small>inkl. Erstattungen</small>
        </div>
        <div className="dash-metric">
          <span>Erstattet</span>
          <strong><AnimatedNumber value={counts.refunded} /></strong>
          <small>aus Bestand entfernt</small>
        </div>
        <div className="dash-metric">
          <span>Statusarten</span>
          <strong><AnimatedNumber value={statusBars.length} /></strong>
          <small>im Pipeline-Mix</small>
        </div>
      </div>

      <div className="dash-bv-charts">
        <section className="dash-bv-card">
          <header>
            <div>
              <h3>Pipeline-Status</h3>
              <p>Aktive Leads nach Bearbeitungsstand</p>
            </div>
          </header>
          {statusBars.length ? (
            <ProgressBars items={statusBars} />
          ) : (
            <div className="dash-empty"><p>Keine aktiven Leads im Bestand.</p></div>
          )}
        </section>

        <section className="dash-bv-card">
          <header>
            <div>
              <h3>Qualität des Bestands</h3>
              <p>Erstattungsquote im Überblick</p>
            </div>
          </header>
          <StatusDonut
            label="Aktiv"
            value={counts.active}
            total={list.length}
            tone="live"
            hint={`${counts.active} von ${list.length} aktiv`}
          />
          <div className="dash-bv-inline-stats">
            <span>{counts.refunded} erstattet</span>
            <span>
              {list.length
                ? `${Math.round((counts.refunded / list.length) * 100)}% Erstattungsquote`
                : '0% Erstattungsquote'}
            </span>
          </div>
        </section>
      </div>

      <section className="dash-bv-card dash-bv-card--list">
        <header className="dash-bv-card__toolbar">
          <div>
            <h3>Zugewiesene Leads</h3>
            <p>{visible.length} angezeigt</p>
          </div>
          <DashSeg
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'Alle', count: list.length },
              { id: 'active', label: 'Aktiv', count: counts.active },
              { id: 'refunded', label: 'Erstattet', count: counts.refunded },
            ]}
          />
        </header>
        <div className="dash-bv-lead-list">
          {visible.map((lead) => (
            <Link
              key={lead.id}
              className="dash-bv-lead"
              to={`/dashboard/leads/${lead.id}`}
            >
              <div className="dash-bv-lead__main">
                <strong>{lead.fullName || 'Ohne Namen'}</strong>
                <span>
                  {[lead.zip, lead.city].filter(Boolean).join(' ') || 'Ohne Ort'}
                  {lead.email ? ` · ${lead.email}` : ''}
                </span>
                <span className="dash-bv-lead__meta">
                  {leadScopeLabel(lead.scope)}
                  {lead.assignedAt ? ` · zugewiesen ${formatDate(lead.assignedAt)}` : ''}
                  {lead.refundedAt ? ` · erstattet ${formatDate(lead.refundedAt)}` : ''}
                </span>
              </div>
              <div className="dash-bv-lead__side">
                {lead.refundedAt ? (
                  <span className="dash-badge dash-badge--danger">Erstattet</span>
                ) : (
                  <span className={`dash-badge dash-badge--${leadTone(lead.status)}`}>
                    {leadStatusLabel(lead.status)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdminBeraterList() {
  const [beraters, setBeraters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    fetchBeraterPipelines()
      .then((payload) => {
        if (active) setBeraters(payload.beraters || []);
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

  const hasRequests = (entry) => (
    (entry.requests || []).length > 0 || Boolean(entry.request)
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return beraters.filter((entry) => {
      const active = hasRequests(entry);
      if (filter === 'active' && !active) return false;
      if (filter === 'inactive' && active) return false;
      if (query) {
        const haystack = `${entry.fullName} ${entry.email} ${entry.company}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [beraters, filter, search]);

  const activeCount = beraters.filter((entry) => hasRequests(entry)).length;
  const inactiveCount = beraters.length - activeCount;

  return (
    <div className="dash-stack">
      {error ? <div className="dash-alert">{error}</div> : null}

      <div className="dash-metrics dash-metrics--three">
        <div className="dash-metric">
          <span>Berater</span>
          <strong>{loading ? '—' : beraters.length}</strong>
          <small>Konten</small>
        </div>
        <div className="dash-metric">
          <span>Aktiv</span>
          <strong>{loading ? '—' : activeCount}</strong>
          <small>mit Lead-Anfragen</small>
        </div>
        <div className="dash-metric">
          <span>Inaktiv</span>
          <strong>{loading ? '—' : inactiveCount}</strong>
          <small>ohne Anfragen</small>
        </div>
      </div>

      <section className="dash-panel">
        <div className="dash-toolbar">
          <DashSeg
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'Alle', count: loading ? null : beraters.length },
              { id: 'active', label: 'Aktiv', count: loading ? null : activeCount },
              { id: 'inactive', label: 'Inaktiv', count: loading ? null : inactiveCount },
            ]}
          />
          <label className="dash-search">
            <span>Suche</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, E-Mail, Firma"
            />
          </label>
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : visible.length ? (
          <div className="dash-lead-list">
            {visible.map((entry) => {
              const request = entry.request;
              return (
                <Link key={entry.id} className="dash-lead-row" to={`/dashboard/berater/${entry.id}`}>
                  <BeraterAvatar berater={entry} size="sm" />
                  <div className="dash-lead-row-main">
                    <strong>{entry.fullName || entry.email}</strong>
                    <span className="dash-lead-row-sub">
                      {[entry.company, entry.email].filter(Boolean).join(' · ')}
                    </span>
                    {request ? (
                      <span className="dash-lead-row-tags">
                        {leadScopeLabel(request.scope)} · {request.validCount} von {request.requestedCount} gültig
                        {request.refundedCount ? ` · ${request.refundedCount} erstattet` : ''}
                        {request.remaining ? ` · ${request.remaining} offen` : ''}
                      </span>
                    ) : (
                      <span className="dash-lead-row-tags">{entry.assignedCount} Leads im Bestand</span>
                    )}
                  </div>
                  <div className="dash-lead-row-side">
                    <PipelineStatus request={request} />
                    {request ? (
                      <span className="dash-mini-progress" aria-hidden="true">
                        <span style={{ width: `${progressPercent(request)}%` }} />
                      </span>
                    ) : null}
                    <small>{formatDate(entry.createdAt)}</small>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="dash-empty">
            <p>
              {filter === 'inactive'
                ? 'Keine inaktiven Berater — alle haben bereits Anfragen gestellt.'
                : filter === 'active'
                  ? 'Noch keine Berater mit Lead-Anfragen.'
                  : 'Keine Berater gefunden. Neue Konten erscheinen nach der Registrierung.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminBeraterDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tabParam = searchParams.get('tab');
  const activeTab = VIEW_TABS.some((tab) => tab.id === tabParam) ? tabParam : 'details';

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBeraterPipeline(id)
      .then((payload) => {
        if (!active) return;
        setData(payload);
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
  }, [id]);

  const berater = data?.berater;
  const requests = data?.requests || [];
  const payments = data?.payments || [];
  const leads = data?.sentLeads || [];
  const totals = useMemo(() => requests.reduce((acc, entry) => ({
    requested: acc.requested + (Number(entry.requestedCount) || 0),
    valid: acc.valid + (Number(entry.validCount) || 0),
    refunded: acc.refunded + (Number(entry.refundedCount) || 0),
    remaining: acc.remaining + (Number(entry.remaining) || 0),
  }), { requested: 0, valid: 0, refunded: 0, remaining: 0 }), [requests]);

  const paidCount = payments.filter((entry) => entry.status === 'paid').length;
  const company = berater?.company || berater?.profile?.company || '';

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'details') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  if (loading) {
    return (
      <div className="dash-stack">
        <Link className="dash-back" to="/dashboard/berater">
          <ArrowLeft size={16} />
          Zurück zu Berater
        </Link>
        <div className="dash-empty"><p>Laden…</p></div>
      </div>
    );
  }

  if (!berater) {
    return (
      <div className="dash-stack">
        <Link className="dash-back" to="/dashboard/berater">
          <ArrowLeft size={16} />
          Zurück zu Berater
        </Link>
        {error ? <div className="dash-alert">{error}</div> : <div className="dash-empty"><p>Berater wurde nicht gefunden.</p></div>}
      </div>
    );
  }

  return (
    <div className="dash-stack dash-bv">
      <Link className="dash-back" to="/dashboard/berater">
        <ArrowLeft size={16} />
        Zurück zu Berater
      </Link>

      {error ? <div className="dash-alert">{error}</div> : null}

      <section className="dash-panel dash-bv-hero">
        <div className="dash-bv-hero__top">
          <BeraterAvatar berater={berater} size="md" />
          <div className="dash-bv-hero__intro">
            <div className="dash-lead-kicker">Beraterprofil</div>
            <h2>{berater.fullName || berater.email}</h2>
            <p>{[company, berater.email].filter(Boolean).join(' · ')}</p>
            <div className="dash-bv-hero__badges">
              <span className={`dash-badge dash-badge--${berater.verified ? 'ok' : 'warn'}`}>
                {berater.verified ? 'Verifiziert' : 'Nicht verifiziert'}
              </span>
              <span className={`dash-badge dash-badge--${berater.onboardingComplete ? 'ok' : 'muted'}`}>
                {berater.onboardingComplete ? 'Profil vollständig' : 'Profil unvollständig'}
              </span>
              {berater.customerNumber ? (
                <span className="dash-badge dash-badge--muted">{berater.customerNumber}</span>
              ) : null}
            </div>
          </div>
          <div className="dash-bv-hero__actions">
            {String(berater.phone || '').trim() ? (
              <a className="dash-bv-action dash-bv-action--call" href={`tel:${String(berater.phone).trim()}`}>
                <Phone size={16} aria-hidden="true" />
                <span>Anrufen</span>
              </a>
            ) : (
              <span className="dash-bv-action is-disabled" title="Keine Telefonnummer">
                <Phone size={16} aria-hidden="true" />
                <span>Anrufen</span>
              </span>
            )}
            {berater.email ? (
              <a className="dash-bv-action dash-bv-action--mail" href={`mailto:${berater.email}`}>
                <Mail size={16} aria-hidden="true" />
                <span>E-Mail</span>
              </a>
            ) : (
              <span className="dash-bv-action is-disabled" title="Keine E-Mail">
                <Mail size={16} aria-hidden="true" />
                <span>E-Mail</span>
              </span>
            )}
          </div>
        </div>

        <nav className="dash-bv-tabs" aria-label="Berater Bereiche">
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.id === 'requests'
              ? requests.length
              : tab.id === 'payment'
                ? paidCount
                : tab.id === 'leads'
                  ? (data.assignedCount || leads.filter((lead) => !lead.refundedAt).length)
                  : null;
            return (
              <button
                key={tab.id}
                type="button"
                className={`dash-bv-tab${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setTab(tab.id)}
                aria-pressed={activeTab === tab.id}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{tab.label}</span>
                {count != null ? <em>{count}</em> : null}
              </button>
            );
          })}
        </nav>
      </section>

      <div key={activeTab} className="dash-bv-stage">
        {activeTab === 'details' ? (
          <DetailsPanel
            berater={berater}
            totals={totals}
            requestCount={requests.length}
            assignedCount={data.assignedCount || 0}
            payments={payments}
          />
        ) : null}
        {activeTab === 'requests' ? (
          <RequestsPanel requests={requests} totals={totals} />
        ) : null}
        {activeTab === 'payment' ? (
          <PaymentPanel payments={payments} />
        ) : null}
        {activeTab === 'leads' ? (
          <LeadsPanel leads={leads} assignedCount={data.assignedCount || 0} />
        ) : null}
      </div>
    </div>
  );
}
