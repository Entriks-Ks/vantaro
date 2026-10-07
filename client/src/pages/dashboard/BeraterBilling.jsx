import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  FileText,
  Hourglass,
  Layers,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { leadTypeLabel } from '../../lib/berater';
import {
  downloadPaymentInvoice,
  fetchMyPayments,
  formatCardMask,
  openPaymentInvoice,
  paymentStatusLabel,
  syncMyPayment,
} from '../../lib/payments';
import { energyPackageById } from '../../lib/vertical';
import { formatDate, formatDateTime, formatEuro, formatEuroExact } from './helpers';
import { packageById } from './packages';
import { CountUp, StatusDonut, Trend } from './paymentCharts';
import { SelectDropdown } from './SelectDropdown';
import {
  STATUS_IDS,
  STATUS_META,
  addMonths,
  amountOf,
  niceMax,
  startOfMonth,
  timeOf,
} from './paymentStats';

const PAGE_SIZE = 10;

const RANGES = [
  { id: '6m', label: '6 Monate', months: 6 },
  { id: '12m', label: '12 Monate', months: 12 },
  { id: 'all', label: 'Gesamt' },
];

const STATUS_BADGE = {
  paid: 'is-paid',
  pending: 'is-pending',
  failed: 'is-unpaid',
  refunded: 'is-refunded',
};

const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });
const monthLong = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

function isAppointment(payment) {
  return String(payment?.leadType || payment?.packageId || '').includes('APPOINTMENT');
}

function unitWord(payment, count) {
  if (isAppointment(payment)) return count === 1 ? 'Termin' : 'Termine';
  return count === 1 ? 'Lead' : 'Leads';
}

function packageName(payment) {
  return packageById(payment.packageId)?.label
    || energyPackageById(payment.packageId)?.label
    || energyPackageById(payment.leadType)?.label
    || String(payment.packageLabel || '').split(' · ')[0]
    || leadTypeLabel(payment.leadType);
}

function hasInvoice(payment) {
  return payment.status === 'paid' || payment.status === 'refunded';
}

function monthBuckets(rangeId, now, earliest) {
  const last = startOfMonth(now);
  const range = RANGES.find((entry) => entry.id === rangeId);
  let first;
  if (range?.months) {
    first = addMonths(last, -(range.months - 1));
  } else {
    first = Math.max(startOfMonth(earliest || now), addMonths(last, -35));
    first = Math.min(first, addMonths(last, -5));
  }
  const buckets = [];
  for (let start = first; start <= last; start = addMonths(start, 1)) {
    buckets.push({
      start,
      end: addMonths(start, 1),
      label: monthLabel.format(new Date(start)),
      longLabel: monthLong.format(new Date(start)),
      spent: 0,
      count: 0,
      units: 0,
    });
  }
  return buckets;
}

function barPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, height, width / 2));
  const bottom = y + height;
  return `M ${x} ${bottom} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + width - r} Q ${x + width} ${y} ${x + width} ${y + r} V ${bottom} Z`;
}

function SpendChart({ buckets }) {
  const [hover, setHover] = useState(null);
  const width = 720;
  const height = 260;
  const pad = { left: 58, right: 16, top: 18, bottom: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const total = buckets.reduce((sum, bucket) => sum + bucket.spent, 0);
  const max = niceMax(Math.max(0, ...buckets.map((bucket) => bucket.spent)));
  const slot = innerW / Math.max(1, buckets.length);
  const barW = Math.max(6, Math.min(40, slot * 0.58));
  const baseline = pad.top + innerH;
  const x = (index) => pad.left + slot * index + slot / 2;
  const y = (value) => pad.top + innerH - (value / max) * innerH;
  const average = buckets.length ? total / buckets.length : 0;
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 12));
  const active = hover != null ? buckets[hover] : null;

  return (
    <div className="dash-pay-chart broker-pay-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monatliche Ausgaben">
        <defs>
          <linearGradient id="broker-pay-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#56d3c4" />
            <stop offset="100%" stopColor="#37cdc0" stopOpacity=".35" />
          </linearGradient>
          <linearGradient id="broker-pay-bar-active" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8b73" />
            <stop offset="100%" stopColor="#ff755a" stopOpacity=".45" />
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
        {buckets.map((bucket, index) => {
          const barH = baseline - y(bucket.spent);
          const isActive = hover === index;
          return (
            <g key={bucket.start}>
              {bucket.spent > 0 ? (
                <path
                  className={`broker-pay-bar${isActive ? ' is-active' : ''}`}
                  d={barPath(x(index) - barW / 2, y(bucket.spent), barW, barH, 7)}
                  fill={isActive ? 'url(#broker-pay-bar-active)' : 'url(#broker-pay-bar)'}
                  style={{ animationDelay: `${index * 40}ms` }}
                />
              ) : (
                <rect
                  className="broker-pay-bar is-empty"
                  x={x(index) - barW / 2}
                  y={baseline - 3}
                  width={barW}
                  height={3}
                  rx={1.5}
                />
              )}
              {index % labelEvery === 0 || index === buckets.length - 1 ? (
                <text className="dash-pay-chart__xlabel" x={x(index)} y={height - 8} textAnchor="middle">
                  {bucket.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {average > 0 ? (
          <g className="broker-pay-avg">
            <line x1={pad.left} x2={width - pad.right} y1={y(average)} y2={y(average)} />
            <text x={width - pad.right} y={y(average) - 6} textAnchor="end">
              Ø {formatEuro(average)} / Monat
            </text>
          </g>
        ) : null}
        {buckets.map((bucket, index) => (
          <rect
            key={bucket.start}
            className="dash-pay-chart__hit"
            x={pad.left + slot * index}
            y={pad.top}
            width={slot}
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
            top: `${(Math.min(y(active.spent), baseline - 3) / height) * 100}%`,
          }}
        >
          <span>{active.longLabel}</span>
          <strong>{formatEuroExact(active.spent)}</strong>
          <small>
            {active.count} Zahlung{active.count === 1 ? '' : 'en'}
            {active.units ? ` · ${active.units} gebucht` : ''}
          </small>
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
  const header = ['Datum', 'Rechnung', 'Paket', 'Menge', 'Gebiet', 'Status', 'Netto', 'MwSt', 'Brutto', 'Zahlungsart'];
  const lines = rows.map((entry) => [
    formatDateTime(entry.paidAt || entry.createdAt),
    entry.invoiceNumber,
    packageName(entry),
    `${entry.leadCount} ${unitWord(entry, entry.leadCount)}`,
    entry.territory || '',
    paymentStatusLabel(entry.status),
    euro(entry.netCents),
    euro(entry.taxCents),
    euro(entry.grossCents),
    formatCardMask(entry),
  ]);
  const csv = [header, ...lines].map((line) => line.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `meine-zahlungen-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function SortHead({ id, label, sort, onSort, align }) {
  const active = sort.key === id;
  const Icon = active && sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      style={align === 'end' ? { textAlign: 'right' } : undefined}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={`dash-pay-sort${active ? ' is-active' : ''}`} onClick={() => onSort(id)}>
        {label}
        <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  );
}

export function BeraterBilling() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const energy = user?.vertical === 'energy';
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [range, setRange] = useState('12m');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [syncingId, setSyncingId] = useState('');
  const [invoiceBusyId, setInvoiceBusyId] = useState('');

  const showBackButton = location.state?.from === '/dashboard/paket';

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const paymentPayload = await fetchMyPayments();
      setPayments(paymentPayload.payments || []);
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
  }, [load]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [range, status, search]);

  const stats = useMemo(() => {
    const now = updatedAt?.getTime() || Date.now();
    const earliest = payments.reduce((min, entry) => Math.min(min, timeOf(entry) || min), now);
    const buckets = monthBuckets(range, now, earliest);
    const months = RANGES.find((entry) => entry.id === range)?.months;
    const start = months ? buckets[0].start : -Infinity;
    const prevStart = months ? addMonths(start, -months) : null;
    const inRange = payments.filter((entry) => timeOf(entry) >= start);
    const previous = prevStart == null
      ? []
      : payments.filter((entry) => timeOf(entry) >= prevStart && timeOf(entry) < start);

    const paid = inRange.filter((entry) => entry.status === 'paid');
    const prevPaid = previous.filter((entry) => entry.status === 'paid');
    const sum = (list, pick) => list.reduce((total, entry) => total + pick(entry), 0);
    const spent = sum(paid, amountOf);
    const prevSpent = sum(prevPaid, amountOf);
    const units = sum(paid, (entry) => Number(entry.leadCount) || 0);
    const prevUnits = sum(prevPaid, (entry) => Number(entry.leadCount) || 0);

    for (const entry of paid) {
      const time = timeOf(entry);
      const bucketIndex = buckets.findIndex((item) => time >= item.start && time < item.end);
      const bucket = buckets[bucketIndex];
      if (bucket) {
        bucket.spent += amountOf(entry);
        bucket.count += 1;
        bucket.units += Number(entry.leadCount) || 0;
      }
    }

    const statusCounts = Object.fromEntries(STATUS_IDS.map((id) => [id, 0]));
    for (const entry of inRange) {
      if (statusCounts[entry.status] != null) statusCounts[entry.status] += 1;
    }
    const pending = inRange.filter((entry) => entry.status === 'pending');
    const successRate = inRange.length
      ? Math.round(((statusCounts.paid + statusCounts.refunded) / inRange.length) * 100)
      : 0;

    return {
      buckets,
      inRange,
      spent,
      prevSpent,
      paidCount: paid.length,
      units,
      prevUnits,
      perUnit: units ? Math.round(spent / units) : 0,
      prevPerUnit: prevUnits ? Math.round(prevSpent / prevUnits) : 0,
      statusCounts,
      pendingCount: pending.length,
      pendingAmount: sum(pending, amountOf),
      successRate,
    };
  }, [payments, range, updatedAt]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = stats.inRange.filter((entry) => {
      if (status !== 'all' && entry.status !== status) return false;
      if (!query) return true;
      return [entry.invoiceNumber, entry.packageLabel, packageName(entry), entry.territory]
        .join(' ')
        .toLowerCase()
        .includes(query);
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

  const handleSyncPending = async (paymentId) => {
    if (!paymentId || syncingId) return;
    setSyncingId(paymentId);
    setError('');
    setNotice('');
    try {
      const result = await syncMyPayment(paymentId);
      await load(true);
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

  const rangeLabel = RANGES.find((entry) => entry.id === range)?.label;
  const compareHint = range === 'all' ? 'seit Ihrer ersten Buchung' : `vs. vorherige ${rangeLabel}`;
  const unitsTitle = energy ? 'Leads & Termine' : 'Gebuchte Leads';
  const statusSegments = STATUS_IDS.map((id) => ({
    id,
    label: paymentStatusLabel(id),
    value: stats.statusCounts[id],
    color: STATUS_META[id].color,
  }));
  const dash = loading ? '—' : null;

  return (
    <div className="broker-page broker-pay">
      {showBackButton && (
        <button
          type="button"
          className="broker-back"
          onClick={() => navigate('/dashboard/paket')}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Zurück zu Pakete & Guthaben</span>
        </button>
      )}
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Abrechnung</div>
          <h1>Zahlungen &amp; <em>Rechnungen</em></h1>
          <p className="lede">
            Alle Ausgaben, Zahlungen und Rechnungen auf einen Blick — bezahlt über die ProCredit Bank.
          </p>
        </div>
      </div>

      <div className="broker-filterbar broker-pay-head-actions">
        <div className="broker-filter-start">
          <SelectDropdown
            label="Zeitraum"
            icon={CalendarRange}
            value={range}
            onChange={setRange}
            options={RANGES}
          />
        </div>
        <div className="broker-filterbar-end">
          {updatedAt ? (
            <span className="broker-filter-count">
              Aktualisiert {updatedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
          <button
            type="button"
            className="broker-pay-icon-btn"
            onClick={() => load(true)}
            disabled={loading || refreshing}
            aria-label="Aktualisieren"
            title="Aktualisieren"
          >
            <RefreshCw size={16} className={refreshing ? 'is-spinning' : undefined} aria-hidden="true" />
          </button>
          <Link to="/dashboard/paket" className="btn btn-primary">
            <CreditCard size={15} aria-hidden="true" />
            {energy ? 'Leads / Termine buchen' : 'Leads buchen'}
          </Link>
        </div>
      </div>

      {notice ? (
        <div className="broker-alert broker-alert--ok">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      ) : null}
      {error ? (
        <div className="broker-alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="broker-home-metrics broker-home-metrics--leads broker-pay-metrics">
        <article className="broker-home-metric is-signal">
          <div className="broker-home-metric-body">
            <span>Ausgaben</span>
            <strong>{dash ?? <CountUp value={stats.spent} format={formatEuroExact} />}</strong>
            <small className="broker-pay-metric-hint">
              {loading ? null : <Trend current={stats.spent} previous={stats.prevSpent} />}
              {compareHint}
            </small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><Wallet size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>{unitsTitle}</span>
            <strong>{dash ?? <CountUp value={stats.units} />}</strong>
            <small className="broker-pay-metric-hint">
              {loading ? null : <Trend current={stats.units} previous={stats.prevUnits} />}
              in {stats.paidCount} Zahlung{stats.paidCount === 1 ? '' : 'en'}
            </small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><Layers size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>Ø Preis pro {energy ? 'Einheit' : 'Lead'}</span>
            <strong>{dash ?? <CountUp value={stats.perUnit} format={formatEuroExact} />}</strong>
            <small>{stats.units ? 'netto, ohne MwSt.' : 'noch keine Buchungen'}</small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><Receipt size={22} /></span>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body">
            <span>Offen</span>
            <strong>{dash ?? <CountUp value={stats.pendingCount} />}</strong>
            <small>
              {stats.pendingCount
                ? `${formatEuroExact(stats.pendingAmount)} warten auf Bestätigung`
                : 'keine offenen Zahlungen'}
            </small>
          </div>
          <span className="broker-home-metric-icon" aria-hidden="true"><Hourglass size={22} /></span>
        </article>
      </div>

      <div className="broker-pay-grid broker-pay-grid--wide">
        <section className="broker-panel">
          <div className="broker-panel-header">
            <div>
              <div className="eyebrow">Verlauf</div>
              <h2>Ausgaben pro Monat</h2>
              <p>Bezahlte Buchungen · {rangeLabel}</p>
            </div>
            {!loading ? <strong className="broker-pay-total">{formatEuroExact(stats.spent)}</strong> : null}
          </div>
          <div className="broker-pay-body">
            {loading ? (
              <div className="dash-pay-skeleton" aria-hidden="true" />
            ) : (
              <SpendChart key={range} buckets={stats.buckets} />
            )}
          </div>
        </section>

        <section className="broker-panel">
          <div className="broker-panel-header">
            <div>
              <div className="eyebrow">Status</div>
              <h2>Zahlungsstatus</h2>
              <p>{stats.inRange.length} Vorgänge im Zeitraum</p>
            </div>
          </div>
          <div className="broker-pay-body">
            {loading ? (
              <div className="dash-pay-skeleton dash-pay-skeleton--round" aria-hidden="true" />
            ) : (
              <StatusDonut
                key={range}
                segments={statusSegments}
                centerValue={`${stats.successRate}%`}
                centerLabel="Erfolgreich"
              />
            )}
          </div>
        </section>
      </div>



      <section className="broker-panel broker-invoice-panel broker-pay-table-panel">
        <div className="broker-panel-header">
          <div>
            <h2>Alle Zahlungen</h2>
            <p>
              {loading ? 'Laden…' : `${rows.length} von ${stats.inRange.length} Vorgängen · ${rangeLabel}`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline broker-pay-export"
            onClick={() => exportCsv(rows)}
            disabled={loading || !rows.length}
          >
            <Download size={15} aria-hidden="true" />
            CSV exportieren
          </button>
        </div>

        <div className="broker-pay-toolbar">
          <div className="broker-pills" role="tablist" aria-label="Status">
            {[{ id: 'all', label: 'Alle', count: stats.inRange.length }, ...STATUS_IDS.map((id) => ({
              id,
              label: paymentStatusLabel(id),
              count: stats.statusCounts[id],
            }))].map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={status === option.id}
                className={status === option.id ? 'is-active' : undefined}
                onClick={() => setStatus(option.id)}
              >
                {option.label}
                {loading ? null : <span className="broker-pill-count">{option.count}</span>}
              </button>
            ))}
          </div>
          <label className="broker-pay-search">
            <Search size={15} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechnung, Paket, Gebiet"
              aria-label="Zahlungen durchsuchen"
            />
          </label>
        </div>

        {loading ? (
          <div className="broker-empty"><p>Zahlungen werden geladen…</p></div>
        ) : rows.length ? (
          <>
            <div className="broker-invoice-table-wrap">
              <table className="broker-invoice-table broker-pay-table">
                <thead>
                  <tr>
                    <SortHead id="date" label="Datum" sort={sort} onSort={onSort} />
                    <th>Paket</th>
                    <th>Zahlungsart</th>
                    <th>Status</th>
                    <SortHead id="amount" label="Betrag" sort={sort} onSort={onSort} align="end" />
                    <th className="broker-invoice-actions-col">Rechnung</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, visibleCount).map((entry, index) => (
                    <tr key={entry.id} style={{ animationDelay: `${Math.min(index, PAGE_SIZE) * 25}ms` }}>
                      <td>
                        <strong className="broker-pay-date">{formatDateTime(entry.paidAt || entry.createdAt)}</strong>
                        <small>{entry.invoiceNumber || '—'}</small>
                      </td>
                      <td>
                        <strong>{packageName(entry)}</strong>
                        <small>
                          {entry.leadCount} {unitWord(entry, entry.leadCount)}
                          {entry.territory ? ` · ${entry.territory}` : ''}
                        </small>
                      </td>
                      <td>
                        <span>{formatCardMask(entry)}</span>
                        {entry.testMode ? <small className="dash-pay-test">Testmodus</small> : null}
                      </td>
                      <td>
                        <span className={`broker-invoice-status ${STATUS_BADGE[entry.status] || 'is-refunded'}`}>
                          {paymentStatusLabel(entry.status)}
                        </span>
                        {entry.status === 'pending' ? (
                          <button
                            type="button"
                            className="broker-text-btn broker-pay-sync"
                            disabled={Boolean(syncingId)}
                            onClick={() => handleSyncPending(entry.id)}
                          >
                            {syncingId === entry.id ? 'Prüfe…' : 'Status prüfen'}
                          </button>
                        ) : null}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong className="broker-inv-amount">{formatEuroExact(amountOf(entry))}</strong>
                        {entry.discountCents > 0 ? (
                          <small>inkl. Rabatt · {formatEuroExact(entry.listCents)}</small>
                        ) : null}
                        {entry.taxCents ? <small>zzgl. {formatEuroExact(entry.taxCents)} MwSt.</small> : null}
                      </td>
                      <td>
                        {hasInvoice(entry) ? (
                          <div className="broker-invoice-actions">
                            <button
                              type="button"
                              className="broker-invoice-action"
                              title="Rechnung öffnen"
                              aria-label={`Rechnung ${entry.invoiceNumber} öffnen`}
                              disabled={Boolean(invoiceBusyId)}
                              onClick={() => runInvoiceAction(entry.id, openPaymentInvoice)}
                            >
                              <FileText size={15} />
                            </button>
                            <button
                              type="button"
                              className="broker-invoice-action"
                              title="Rechnung herunterladen"
                              aria-label={`Rechnung ${entry.invoiceNumber} herunterladen`}
                              disabled={Boolean(invoiceBusyId)}
                              onClick={() => runInvoiceAction(entry.id, downloadPaymentInvoice)}
                            >
                              <Download size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="broker-pay-no-invoice">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > visibleCount ? (
              <div className="broker-pay-more">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Weitere {Math.min(PAGE_SIZE, rows.length - visibleCount)} anzeigen
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="broker-empty">
            <p>
              {payments.length
                ? 'Keine Zahlungen für diese Auswahl.'
                : 'Noch keine Zahlungen. Sobald Sie ein Paket buchen, erscheinen Zahlung und Rechnung hier.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
