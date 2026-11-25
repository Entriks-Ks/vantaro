import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, CalendarClock, Clock } from 'lucide-react';
import { fetchMyLeads } from '../../lib/leads';
import { useBroker } from '../../hooks/useBroker';
import { useAuth } from '../../hooks/useAuth';
import { eventAlertsEnabled, readBrokerSettings, subscribeBrokerSettings, writeBrokerSettings } from '../../lib/brokerSettings';
import { formatDateTime } from './helpers';
import { L } from '../../lib/i18n';

export const SCHEDULE_HOUR_MS = 60 * 60 * 1000;
export const SCHEDULE_SOON_MS = 15 * 60 * 1000;
const POLL_MS = 60 * 1000;
const TICK_MS = 15 * 1000;

function leadName(lead) {
  return `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || lead?.name || 'Lead';
}

function scheduleItemsFromLeads(leads) {
  const items = [];
  (leads || []).forEach((lead) => {
    const status = lead.contactStatus || lead.status;
    if (status === 'termin' && lead.appointmentAt) {
      items.push({
        id: `${lead.id}-termin`,
        leadId: lead.id,
        kind: 'termin',
        at: lead.appointmentAt,
        name: leadName(lead),
      });
    }
    if (status === 'wiedervorlage' && lead.followUpAt) {
      items.push({
        id: `${lead.id}-wiedervorlage`,
        leadId: lead.id,
        kind: 'wiedervorlage',
        at: lead.followUpAt,
        name: leadName(lead),
      });
    }
  });
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function alertLevelOf(at, now) {
  const due = new Date(at).getTime();
  if (!Number.isFinite(due)) return null;
  const remaining = due - now;
  if (remaining <= SCHEDULE_SOON_MS) return remaining <= 0 ? 'overdue' : 'soon';
  if (remaining <= SCHEDULE_HOUR_MS) return 'hour';
  return null;
}

function formatWhen(value) {
  const text = formatDateTime(value).replace(',', ' · ');
  return /uhr/i.test(text) ? text : L(`${text} Uhr`, text);
}

function alertCopy(item, level) {
  const noun = item.kind === 'termin' ? L('Termin', 'Appointment') : L('Wiedervorlage', 'Follow-up');
  if (level === 'overdue') return L(`${noun} ist fällig · ${item.name}`, `${noun} is due · ${item.name}`);
  if (level === 'soon') return L(`${noun} in 15 Minuten · ${item.name}`, `${noun} in 15 minutes · ${item.name}`);
  return L(`${noun} in 1 Stunde · ${item.name}`, `${noun} in 1 hour · ${item.name}`);
}

function notifyBrowser(item, level) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(alertCopy(item, level), {
      body: formatWhen(item.at),
      tag: `${item.id}:${level}`,
    });
  } catch {
    /* ignore blocked notifications */
  }
}

const READ_STORAGE_KEY = 'vantaro.scheduleBell.read';

function readStoredKeys() {
  try {
    const raw = sessionStorage.getItem(READ_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeStoredKeys(keys) {
  try {
    sessionStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    /* ignore quota / private mode */
  }
}

function eventKeyOf(item, level) {
  if (!level) return null;
  return `${item.id}:${level === 'hour' ? 'hour' : 'soon'}`;
}

export default function ScheduleBell() {
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useBroker();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [leads, setLeads] = useState([]);
  const [readKeys, setReadKeys] = useState(readStoredKeys);
  const [prefs, setPrefs] = useState(readBrokerSettings);
  const wrapRef = useRef(null);
  const toastedKeys = useRef(new Set());
  const primed = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => subscribeBrokerSettings(setPrefs), []);

  useEffect(() => {
    if (user?.settings) setPrefs(writeBrokerSettings(user.settings));
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    function load() {
      fetchMyLeads()
        .then((payload) => {
          if (active) setLeads(payload.leads || []);
        })
        .catch(() => {
          if (active) setLeads([]);
        })
        .finally(() => {
          if (active) setReady(true);
        });
    }
    load();
    const poll = window.setInterval(load, POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      active = false;
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onPointer(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const items = useMemo(() => {
    const horizon = now + 14 * 24 * 60 * 60 * 1000;
    return scheduleItemsFromLeads(leads).filter((item) => {
      const due = new Date(item.at).getTime();
      return Number.isFinite(due) && due <= horizon;
    });
  }, [leads, now]);

  const alertEvents = useMemo(() => {
    const events = [];
    items.forEach((item) => {
      const level = alertLevelOf(item.at, now);
      const key = eventKeyOf(item, level);
      if (!key) return;
      events.push({ item, level, key });
    });
    return events;
  }, [items, now]);

  const unreadEvents = useMemo(
    () => alertEvents.filter((event) => (
      !readKeys.has(event.key) && eventAlertsEnabled(prefs, event.item.kind)
    )),
    [alertEvents, readKeys, prefs],
  );
  const unreadKeySet = useMemo(
    () => new Set(unreadEvents.map((event) => event.key)),
    [unreadEvents],
  );

  useEffect(() => {
    if (!ready) return;
    if (!primed.current) {
      alertEvents.forEach((event) => toastedKeys.current.add(event.key));
      primed.current = true;
      return;
    }
    unreadEvents.forEach((event) => {
      if (toastedKeys.current.has(event.key)) return;
      toastedKeys.current.add(event.key);
      if (prefs.toastAlerts) showToast(alertCopy(event.item, event.level));
      if (prefs.browserAlerts) notifyBrowser(event.item, event.level);
    });
  }, [alertEvents, unreadEvents, showToast, ready, prefs.toastAlerts, prefs.browserAlerts]);

  function markAlertsRead() {
    if (!alertEvents.length) return;
    setReadKeys((prev) => {
      const next = new Set(prev);
      alertEvents.forEach((event) => next.add(event.key));
      writeStoredKeys(next);
      return next;
    });
  }

  function toggleOpen() {
    setOpen((value) => {
      if (!value) markAlertsRead();
      return !value;
    });
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  const badge = unreadEvents.length;
  const hasSoon = unreadEvents.some((event) => event.level === 'soon' || event.level === 'overdue');

  return (
    <div className="broker-bell" ref={wrapRef}>
      <button
        type="button"
        className={`broker-bell-btn${open ? ' is-open' : ''}${badge ? (hasSoon ? ' has-alert' : ' has-hour') : ''}`}
        aria-label={badge ? L(`${badge} Termine oder Wiedervorlagen in Kürze`, `${badge} appointments or follow-ups coming up`) : L('Termine und Wiedervorlagen', 'Appointments and follow-ups')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggleOpen}
      >
        <Bell size={18} />
        {badge ? <span className="broker-bell-badge">{badge > 9 ? '9+' : badge}</span> : null}
      </button>
      {open ? (
        <div className="broker-bell-panel" role="dialog" aria-label={L('Termine und Wiedervorlagen', 'Appointments and follow-ups')}>
          <div className="broker-bell-panel-head">
            <strong>{L('Termine', 'Appointments')}</strong>
            <span>{items.length ? `${items.length}` : L('Keine', 'None')}</span>
          </div>
          {items.length ? (
            <ul className="broker-bell-list">
              {items.map((item) => {
                const level = alertLevelOf(item.at, now);
                const unread = unreadKeySet.has(eventKeyOf(item, level));
                const Icon = item.kind === 'termin' ? CalendarClock : Clock;
                return (
                  <li key={item.id}>
                    <Link
                      to={`/dashboard/leads/${item.leadId}`}
                      className={`broker-bell-item${unread && level ? ` is-${level}` : ''}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className="broker-bell-item-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span className="broker-bell-item-copy">
                        <strong>{item.name}</strong>
                        <small>{formatWhen(item.at)}</small>
                      </span>
                      <span className="broker-bell-item-kind">
                        {item.kind === 'termin' ? L('Termin', 'Appointment') : L('Wiedervorlage', 'Follow-up')}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="broker-bell-empty">{L('Keine Termine oder Wiedervorlagen.', 'No appointments or follow-ups.')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
