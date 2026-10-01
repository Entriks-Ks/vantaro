import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { leadTypeLabel } from '../../lib/berater';
import { fetchAllPayments, formatCardMask, openPaymentInvoice, paymentStatusLabel } from '../../lib/payments';
import { leadScopeLabel } from '../../lib/scopes';
import { DashSeg } from './DashboardLayout';
import { formatDateTime, formatEuro, formatEuroExact, initials } from './helpers';
import { CountUp, ShareBars, StatusDonut, Trend } from './paymentCharts';
import {
  STATUS_IDS,
  STATUS_META,
  TYPE_COLORS,
  addMonths,
  amountOf,
  niceMax,
  smoothPath,
  startOfDay,
  startOfMonth,
  timeOf,
} from './paymentStats';

const DAY = 86_400_000;
const REFRESH_MS = 60_000;
const PAGE_SIZE = 12;

const RANGES = [
  { id: '30d', label: '30 Tage' },
  { id: '90d', label: '90 Tage' },
  { id: '12m', label: '12 Monate' },
  { id: 'all', label: 'Gesamt' },
];

const dayLabel = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });

function buildBuckets(rangeId, now, earliest) {
  const buckets = [];
  if (rangeId === '30d' || rangeId === '90d') {
    const size = rangeId === '30d' ? 1 : 7;
    const count = rangeId === '30d' ? 30 : 13;
    const first = startOfDay(now) - (count * size - 1) * DAY;
    for (let i = 0; i < count; i += 1) {
      const start = first + i * size * DAY;
      buckets.push({
        start,
        end: start + size * DAY,
        label: dayLabel.format(new Date(start + DAY / 2)),
      });
    }
    return buckets;
  }
  const last = startOfMonth(now);
  let first = rangeId === '12m' ? addMonths(last, -11) : startOfMonth(earliest || now);
  if (rangeId === 'all') {
    first = Math.min(first, addMonths(last, -5));
    first = Math.max(first, addMonths(last, -35));
  }
  for (let start = first; start <= last; start = addMonths(start, 1)) {
    buckets.push({ start, end: addMonths(start, 1), label: monthLabel.format(new Date(start)) });
  }
  return buckets;
}

function Kpi({ label, children, hint, trend, accent }) {
  return (
    <article className={`dash-pay-kpi${accent ? ' is-accent' : ''}`}>
      <div className="dash-pay-kpi__top">
        <span>{label}</span>
        {trend}
      </div>
      <strong>{children}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function RevenueChart({ buckets }) {
  const [hover, setHover] = useState(null);
  const width = 720;
  const height = 240;
  const pad = { left: 58, right: 14, top: 16, bottom: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...buckets.map((bucket) => bucket.revenue)));
  const step = buckets.length > 1 ? innerW / (buckets.length - 1) : 0;
  const x = (index) => pad.left + (buckets.length > 1 ? index * step : innerW / 2);
  const y = (value) => pad.top + innerH - (value / max) * innerH;
  const points = buckets.map((bucket, index) => [x(index), y(bucket.revenue)]);
  const line = smoothPath(points);
  const baseline = pad.top + innerH;
  const area = points.length
    ? `${line} L ${points[points.length - 1][0]} ${baseline} L ${points[0][0]} ${baseline} Z`
    : '';
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 7));
  const active = hover != null ? buckets[hover] : null;
  const colWidth = buckets.length > 1 ? step : innerW;

  return (
    <div className="dash-pay-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Umsatzverlauf">
        <defs>
          <linearGradient id="dash-pay-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#37cdc0" stopOpacity=".38" />
            <stop offset="100%" stopColor="#37cdc0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = max * fraction;
          return (
            <g key={fraction} className="dash-pay-chart__grid">
              <line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} />
              <text x={pad.left - 10} y={y(value) + 4} textAnchor="end">{formatEuro(value)}</text>
            </g>
          );
        })}
        {buckets.map((bucket, index) => (
          index % labelEvery === 0 || index === buckets.length - 1 ? (
            <text
              key={bucket.start}
              className="dash-pay-chart__xlabel"
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
            >
              {bucket.label}
            </text>
          ) : null
        ))}
        <path className="dash-pay-chart__area" d={area} fill="url(#dash-pay-area)" />
        <path className="dash-pay-chart__line" d={line} pathLength="1" />
        {active ? (
          <g className="dash-pay-chart__focus">
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={baseline} />
            <circle cx={x(hover)} cy={y(active.revenue)} r="5" />
          </g>
        ) : null}
        {buckets.map((bucket, index) => (
          <rect
            key={bucket.start}
            className="dash-pay-chart__hit"
            x={x(index) - colWidth / 2}
            y={pad.top}
            width={colWidth}
            height={innerH}
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>
      {active ? (
        <div
          className="dash-pay-chart__tip"
          style={{
            left: `${(x(hover) / width) * 100}%`,
            top: `${(y(active.revenue) / height) * 100}%`,
          }}
        >
          <span>{active.label}</span>
          <strong>{formatEuroExact(active.revenue)}</strong>
          <small>{active.count} Zahlung{active.count === 1 ? '' : 'en'}</small>
        </div>
      ) : null}
    </div>
  );
}

function exportCsv(rows) {
  const escape = (value) => {
    const text = String(value ?? '');
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const euro = (cents) => ((Number(cents) || 0) / 100).toFixed(2).replace('.', ',');
  const header = [
    'Datum', 'Rechnung', 'Berater', 'E-Mail', 'Firma', 'Paket', 'Lead-Typ', 'Leads',
    'Status', 'Netto', 'MwSt', 'Brutto', 'Zahlungsart', 'Testmodus',
  ];
  const lines = rows.map((entry) => [
    formatDateTime(entry.paidAt || entry.createdAt),
    entry.invoiceNumber,
    entry.berater?.fullName || entry.billingName || '',
    entry.billingEmail || entry.berater?.email || '',
    entry.billingCompany || entry.berater?.company || '',
    entry.packageLabel,
    leadTypeLabel(entry.leadType),
    entry.leadCount,
    paymentStatusLabel(entry.status),
    euro(entry.netCents),
    euro(entry.taxCents),
    euro(entry.grossCents),
    formatCardMask(entry),
    entry.testMode ? 'Ja' : 'Nein',
  ]);
  const csv = [header, ...lines].map((line) => line.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `zahlungen-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function SortHead({ id, label, sort, onSort, align }) {
  const active = sort.key === id;
  const Icon = active && sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th className={align === 'end' ? 'is-end' : undefined} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`dash-pay-sort${active ? ' is-active' : ''}`} onClick={() => onSort(id)}>
        {label}
        <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  );
}

export function AdminPayment() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [range, setRange] = useState('30d');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const knownIds = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const payload = await fetchAllPayments();
      const next = payload.payments || [];
      if (knownIds.current) {
        const added = next.filter((entry) => !knownIds.current.has(entry.id)).map((entry) => entry.id);
        if (added.length) {
          setFreshIds(new Set(added));
          window.setTimeout(() => setFreshIds(new Set()), 4000);
        }
      }
      knownIds.current = new Set(next.map((entry) => entry.id));
      setPayments(next);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [range, status, search]);

  const stats = useMemo(() => {
    const now = updatedAt?.getTime() || Date.now();
    const earliest = payments.reduce((min, entry) => Math.min(min, timeOf(entry) || min), now);
    const buckets = buildBuckets(range, now, earliest).map((bucket) => ({ ...bucket, revenue: 0, count: 0 }));
    const start = range === 'all' ? -Infinity : buckets[0].start;
    const span = now - start;
    const inRange = payments.filter((entry) => timeOf(entry) >= start);
    const previous = range === 'all'
      ? []
      : payments.filter((entry) => timeOf(entry) >= start - span && timeOf(entry) < start);

    const paid = inRange.filter((entry) => entry.status === 'paid');
    const prevPaid = previous.filter((entry) => entry.status === 'paid');
    const revenue = paid.reduce((sum, entry) => sum + amountOf(entry), 0);
    const prevRevenue = prevPaid.reduce((sum, entry) => sum + amountOf(entry), 0);
    const leads = paid.reduce((sum, entry) => sum + (Number(entry.leadCount) || 0), 0);
    const prevLeads = prevPaid.reduce((sum, entry) => sum + (Number(entry.leadCount) || 0), 0);

    for (const entry of paid) {
      const time = timeOf(entry);
      const bucket = buckets.find((item) => time >= item.start && time < item.end);
      if (bucket) {
        bucket.revenue += amountOf(entry);
        bucket.count += 1;
      }
    }

    const statusCounts = Object.fromEntries(STATUS_IDS.map((id) => [id, 0]));
    for (const entry of inRange) {
      if (statusCounts[entry.status] != null) statusCounts[entry.status] += 1;
    }
    const settled = statusCounts.paid + statusCounts.refunded;
    const successRate = inRange.length ? Math.round((settled / inRange.length) * 100) : 0;
    const pendingAmount = inRange
      .filter((entry) => entry.status === 'pending')
      .reduce((sum, entry) => sum + amountOf(entry), 0);

    const byType = new Map();
    const byBerater = new Map();
    for (const entry of paid) {
      const typeKey = entry.leadType || 'PKV';
      const type = byType.get(typeKey) || { id: typeKey, label: leadTypeLabel(typeKey), value: 0, count: 0, leads: 0 };
      type.value += amountOf(entry);
      type.count += 1;
      type.leads += Number(entry.leadCount) || 0;
      byType.set(typeKey, type);

      const beraterKey = entry.beraterId || 'unknown';
      const berater = byBerater.get(beraterKey) || { id: beraterKey, berater: entry.berater, value: 0, count: 0 };
      berater.value += amountOf(entry);
      berater.count += 1;
      byBerater.set(beraterKey, berater);
    }

    return {
      buckets,
      inRange,
      revenue,
      prevRevenue,
      paidCount: paid.length,
      prevPaidCount: prevPaid.length,
      leads,
      prevLeads,
      avgOrder: paid.length ? Math.round(revenue / paid.length) : 0,
      prevAvgOrder: prevPaid.length ? Math.round(prevRevenue / prevPaid.length) : 0,
      statusCounts,
      successRate,
      pendingAmount,
      types: [...byType.values()]
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({
          ...entry,
          color: TYPE_COLORS[index % TYPE_COLORS.length],
          hint: `${entry.count} Zahlung${entry.count === 1 ? '' : 'en'} · ${entry.leads} Leads`,
        })),
      topBerater: [...byBerater.values()].sort((a, b) => b.value - a.value).slice(0, 5),
    };
  }, [payments, range, updatedAt]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = stats.inRange.filter((entry) => {
      if (status !== 'all' && entry.status !== status) return false;
      if (!query) return true;
      const haystack = [
        entry.berater?.fullName, entry.berater?.email, entry.berater?.company,
        entry.billingCompany, entry.billingEmail, entry.billingName,
        entry.invoiceNumber, entry.packageLabel,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
    const factor = sort.dir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => (
      sort.key === 'amount'
        ? (amountOf(a) - amountOf(b)) * factor
        : (timeOf(a) - timeOf(b)) * factor
    ));
  }, [stats.inRange, status, search, sort]);

  const onSort = (key) => {
    setSort((current) => (
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    ));
  };

  const openInvoice = (event, paymentId) => {
    event.stopPropagation();
    openPaymentInvoice(paymentId).catch((err) => setError(err.message));
  };

  const statusSegments = STATUS_IDS.map((id) => ({
    id,
    label: paymentStatusLabel(id),
    value: stats.statusCounts[id],
    color: STATUS_META[id].color,
  }));
  const rangeLabel = RANGES.find((entry) => entry.id === range)?.label;
  const compareHint = range === 'all' ? 'seit Start' : `vs. vorherige ${rangeLabel}`;
  const topMax = Math.max(1, ...stats.topBerater.map((entry) => entry.value));
  const dash = loading ? '—' : null;

  return (
    <div className="dash-stack dash-pay">
      {error ? <div className="dash-alert">{error}</div> : null}

      <section className="dash-panel dash-pay-head">
        <div>
          <div className="dash-pay-live">
            <span className={`dash-pay-live__dot${refreshing ? ' is-busy' : ''}`} aria-hidden="true" />
            Live
            {updatedAt ? <em>Aktualisiert {updatedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</em> : null}
          </div>
          <h2>Zahlungsübersicht</h2>
          <p>Umsatz, Zahlungsstatus und alle Transaktionen über ProCredit Bank.</p>
        </div>
        <div className="dash-pay-head__actions">
          <DashSeg value={range} onChange={setRange} options={RANGES} />
          <button
            type="button"
            className="dash-btn dash-btn--ghost dash-pay-refresh"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Aktualisieren"
          >
            <RefreshCw size={15} className={refreshing ? 'is-spinning' : undefined} aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="dash-pay-kpis">
        <Kpi
          label="Umsatz (netto)"
          accent
          trend={loading ? null : <Trend current={stats.revenue} previous={stats.prevRevenue} />}
          hint={compareHint}
        >
          {dash ?? <CountUp value={stats.revenue} format={formatEuro} />}
        </Kpi>
        <Kpi
          label="Bezahlte Zahlungen"
          trend={loading ? null : <Trend current={stats.paidCount} previous={stats.prevPaidCount} />}
          hint={stats.statusCounts.pending
            ? `${stats.statusCounts.pending} offen · ${formatEuro(stats.pendingAmount)}`
            : 'keine offenen Zahlungen'}
        >
          {dash ?? <CountUp value={stats.paidCount} />}
        </Kpi>
        <Kpi
          label="Ø Bestellwert"
          trend={loading ? null : <Trend current={stats.avgOrder} previous={stats.prevAvgOrder} />}
          hint="pro bezahlter Bestellung"
        >
          {dash ?? <CountUp value={stats.avgOrder} format={formatEuro} />}
        </Kpi>
        <Kpi
          label="Leads verkauft"
          trend={loading ? null : <Trend current={stats.leads} previous={stats.prevLeads} />}
          hint={stats.leads ? `Ø ${formatEuroExact(Math.round(stats.revenue / stats.leads))} pro Lead` : 'noch keine Leads'}
        >
          {dash ?? <CountUp value={stats.leads} />}
        </Kpi>
      </div>

      <div className="dash-pay-grid dash-pay-grid--wide">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <strong>Umsatzverlauf</strong>
              <p className="dash-panel-lede">Bezahlte Zahlungen · {rangeLabel}</p>
            </div>
          </div>
          {loading ? (
            <div className="dash-pay-skeleton" aria-hidden="true" />
          ) : (
            <RevenueChart key={range} buckets={stats.buckets} />
          )}
        </section>

        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <strong>Zahlungsstatus</strong>
              <p className="dash-panel-lede">{stats.inRange.length} Vorgänge im Zeitraum</p>
            </div>
          </div>
          {loading ? (
            <div className="dash-pay-skeleton dash-pay-skeleton--round" aria-hidden="true" />
          ) : (
            <StatusDonut
              key={range}
              segments={statusSegments}
              centerValue={`${stats.successRate}%`}
              centerLabel="Erfolgsquote"
            />
          )}
        </section>
      </div>

      <div className="dash-pay-grid">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <strong>Umsatz nach Lead-Typ</strong>
              <p className="dash-panel-lede">Anteil am Umsatz im Zeitraum</p>
            </div>
          </div>
          {loading ? (
            <div className="dash-pay-skeleton dash-pay-skeleton--short" aria-hidden="true" />
          ) : (
            <ShareBars key={range} rows={stats.types} empty="Keine bezahlten Zahlungen im Zeitraum." />
          )}
        </section>

        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <strong>Top Berater</strong>
              <p className="dash-panel-lede">Nach Umsatz im Zeitraum</p>
            </div>
            <Link to="/dashboard/berater">Alle Berater</Link>
          </div>
          {loading ? (
            <div className="dash-pay-skeleton dash-pay-skeleton--short" aria-hidden="true" />
          ) : stats.topBerater.length ? (
            <ol className="dash-pay-top">
              {stats.topBerater.map((entry, index) => {
                const name = entry.berater?.fullName || entry.berater?.email || 'Unbekannt';
                const content = (
                  <>
                    <span className="dash-pay-top__rank">{index + 1}</span>
                    <span className="dash-avatar dash-avatar--sm" aria-hidden="true">
                      {entry.berater?.avatarUrl ? <img src={entry.berater.avatarUrl} alt="" /> : initials(entry.berater || {})}
                    </span>
                    <span className="dash-pay-top__main">
                      <strong>{name}</strong>
                      <small>
                        {entry.count} Zahlung{entry.count === 1 ? '' : 'en'}
                        {entry.berater?.company ? ` · ${entry.berater.company}` : ''}
                      </small>
                      <span className="dash-pay-top__bar" aria-hidden="true">
                        <span style={{ width: `${(entry.value / topMax) * 100}%` }} />
                      </span>
                    </span>
                    <b>{formatEuro(entry.value)}</b>
                  </>
                );
                return (
                  <li key={entry.id} style={{ animationDelay: `${index * 60}ms` }}>
                    {entry.id !== 'unknown' ? (
                      <Link to={`/dashboard/berater/${entry.id}`}>{content}</Link>
                    ) : (
                      <div>{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="dash-empty"><p>Noch keine Umsätze im Zeitraum.</p></div>
          )}
        </section>
      </div>

      <section className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <strong>Transaktionen</strong>
            <p className="dash-panel-lede">
              {loading ? 'Laden…' : `${rows.length} von ${stats.inRange.length} Vorgängen · ${rangeLabel}`}
            </p>
          </div>
          <button
            type="button"
            className="dash-btn dash-btn--ghost"
            onClick={() => exportCsv(rows)}
            disabled={loading || !rows.length}
          >
            <Download size={15} aria-hidden="true" />
            CSV exportieren
          </button>
        </div>

        <div className="dash-toolbar">
          <DashSeg
            value={status}
            onChange={setStatus}
            options={[
              { id: 'all', label: 'Alle', count: loading ? null : stats.inRange.length },
              ...STATUS_IDS.map((id) => ({
                id,
                label: paymentStatusLabel(id),
                count: loading ? null : stats.statusCounts[id],
              })),
            ]}
          />
          <label className="dash-search">
            <span>Suche</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Berater, Firma, Rechnung"
            />
          </label>
        </div>

        {loading ? (
          <div className="dash-empty"><p>Laden…</p></div>
        ) : rows.length ? (
          <>
            <div className="dash-table-wrap">
              <table className="dash-table dash-pay-table">
                <thead>
                  <tr>
                    <SortHead id="date" label="Datum" sort={sort} onSort={onSort} />
                    <th>Berater</th>
                    <th>Paket</th>
                    <th>Zahlungsart</th>
                    <th>Status</th>
                    <SortHead id="amount" label="Betrag" sort={sort} onSort={onSort} align="end" />
                    <th className="is-end" aria-label="Rechnung" />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, visibleCount).map((entry, index) => {
                    const meta = STATUS_META[entry.status] || STATUS_META.refunded;
                    return (
                      <tr
                        key={entry.id}
                        className={`${entry.beraterId ? 'is-clickable' : ''}${freshIds.has(entry.id) ? ' is-fresh' : ''}`}
                        style={{ animationDelay: `${Math.min(index, PAGE_SIZE) * 25}ms` }}
                        onClick={entry.beraterId ? () => navigate(`/dashboard/berater/${entry.beraterId}`) : undefined}
                      >
                        <td>
                          {formatDateTime(entry.paidAt || entry.createdAt)}
                          <small>{entry.invoiceNumber || '—'}</small>
                        </td>
                        <td>
                          <div className="dash-pay-who">
                            <span className="dash-avatar dash-avatar--sm" aria-hidden="true">
                              {entry.berater?.avatarUrl ? <img src={entry.berater.avatarUrl} alt="" /> : initials(entry.berater || {})}
                            </span>
                            <div>
                              <strong>{entry.berater?.fullName || entry.billingName || entry.berater?.email || 'Berater'}</strong>
                              <small>{entry.billingCompany || entry.berater?.company || entry.billingEmail || entry.berater?.email || '—'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {entry.packageLabel || leadTypeLabel(entry.leadType)}
                          <small>
                            {leadTypeLabel(entry.leadType)} · {entry.leadCount} Leads
                            {entry.scope ? ` · ${leadScopeLabel(entry.scope)}` : ''}
                          </small>
                        </td>
                        <td>
                          {formatCardMask(entry)}
                          {entry.testMode ? <small className="dash-pay-test">Testmodus</small> : null}
                        </td>
                        <td>
                          <span className={`dash-badge dash-badge--${meta.tone}`}>
                            {paymentStatusLabel(entry.status)}
                          </span>
                        </td>
                        <td className="is-end">
                          <strong className="dash-pay-amount">{formatEuroExact(amountOf(entry))}</strong>
                          {entry.taxCents ? <small>zzgl. {formatEuroExact(entry.taxCents)} MwSt</small> : null}
                        </td>
                        <td className="is-end">
                          {entry.status === 'paid' ? (
                            <button
                              type="button"
                              className="dash-pay-icon-btn"
                              onClick={(event) => openInvoice(event, entry.id)}
                              aria-label="Rechnung öffnen"
                              title="Rechnung öffnen"
                            >
                              <FileText size={15} aria-hidden="true" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > visibleCount ? (
              <div className="dash-pay-more">
                <button type="button" className="dash-btn dash-btn--ghost" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  Weitere {Math.min(PAGE_SIZE, rows.length - visibleCount)} anzeigen
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="dash-empty">
            <p>
              {payments.length
                ? 'Keine Zahlungen für diese Auswahl.'
                : 'Noch keine Zahlungen. Sobald ein Berater ein Paket kauft, erscheint der Vorgang hier.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
