import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatEuroExact } from './helpers';

function useMounted() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return ready;
}

export function CountUp({ value, format, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = from + (to - from) * (1 - (1 - progress) ** 3);
      fromRef.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{format ? format(display) : Math.round(display).toLocaleString('de-DE')}</>;
}

export function Trend({ current, previous }) {
  if (!previous && !current) return null;
  if (!previous) return <span className="dash-pay-trend is-up">Neu</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`dash-pay-trend ${up ? 'is-up' : 'is-down'}`}>
      <Icon size={13} aria-hidden="true" />
      {up ? '+' : ''}{pct}%
    </span>
  );
}

export function StatusDonut({ segments, centerValue, centerLabel }) {
  const ready = useMounted();
  const size = 168;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, entry) => sum + entry.value, 0);
  let offset = 0;

  return (
    <div className="dash-pay-donut">
      <div className="dash-pay-donut__ring">
        <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle className="dash-pay-donut__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
          {segments.map((entry) => {
            const length = total ? (entry.value / total) * circumference : 0;
            const slice = (
              <circle
                key={entry.id}
                className="dash-pay-donut__seg"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={entry.color}
                strokeWidth={stroke}
                strokeDasharray={ready ? `${length} ${circumference - length}` : `0 ${circumference}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += length;
            return slice;
          })}
        </svg>
        <div className="dash-pay-donut__center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="dash-pay-legend">
        {segments.map((entry) => (
          <li key={entry.id}>
            <i style={{ background: entry.color }} aria-hidden="true" />
            <span>{entry.label}</span>
            <b>{entry.value}</b>
            <em>{total ? Math.round((entry.value / total) * 100) : 0}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShareBars({ rows, empty }) {
  const ready = useMounted();
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <div className="dash-empty"><p>{empty}</p></div>;
  return (
    <div className="dash-pay-bars">
      {rows.map((row) => (
        <div key={row.id} className="dash-pay-bars__row">
          <div className="dash-pay-bars__meta">
            <span>{row.label}</span>
            <b>{formatEuroExact(row.value)}</b>
          </div>
          <span className="dash-pay-bars__track" aria-hidden="true">
            <span style={{ width: ready ? `${Math.max(3, (row.value / max) * 100)}%` : 0, background: row.color }} />
          </span>
          <small>{row.hint}</small>
        </div>
      ))}
    </div>
  );
}
