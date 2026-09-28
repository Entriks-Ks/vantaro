import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Mail,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  ENERGY_DEFAULT_PAGE_IDS,
  ENERGY_PAGE_OPTIONS,
  ENERGY_ROLE_LABELS,
  assignEnergyHolder,
  createEnergyPartner,
  fetchEnergyPartners,
  updateEnergyPartner,
} from '../../lib/energy';
import { initials } from './helpers';

export function EnergyLeadActions({ lead, onChange }) {
  const { user, isAdmin } = useAuth();
  const role = user?.energyRole || 'main';
  const canAssign = role === 'main' || role === 'dispatcher' || isAdmin;
  const [partners, setPartners] = useState([]);
  const [partnersState, setPartnersState] = useState(canAssign ? 'loading' : 'idle');
  const [partnersError, setPartnersError] = useState('');
  const [holderId, setHolderId] = useState(lead.energyHolderId || '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPartners = () => {
    setPartnersState('loading');
    setPartnersError('');
    fetchEnergyPartners()
      .then((payload) => {
        setPartners(payload.partners || []);
        setPartnersState('ready');
      })
      .catch((err) => {
        setPartnersError(err.message || 'Partner konnten nicht geladen werden.');
        setPartnersState('error');
      });
  };

  useEffect(() => {
    if (canAssign) loadPartners();
  }, [canAssign]);

  useEffect(() => {
    setHolderId(lead.energyHolderId || '');
  }, [lead.energyHolderId]);

  const run = async (task, successMessage) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const payload = await task();
      if (payload?.lead) onChange(payload.lead);
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!canAssign) return null;

  const assignable = partners.filter((partner) => partner.active !== false || partner.id === lead.energyHolderId);
  const selected = partners.find((partner) => partner.id === holderId);
  const holder = partners.find((partner) => partner.id === lead.energyHolderId);
  const isAssigned = Boolean(lead.energyHolderId);

  return (
    <div className="broker-detail-side-block energy-actions">
      <div className="broker-detail-section-head">
        <span className="broker-detail-section-icon" aria-hidden="true"><Users size={18} /></span>
        <div>
          <h2>Bearbeitung durch</h2>
          <p>{isAssigned ? `Aktuell bei ${holder?.fullName || 'einem Partner'}` : 'Noch bei Ihrer Firma'}</p>
        </div>
      </div>
      {error ? <div className="broker-alert">{error}</div> : null}
      {notice ? <div className="broker-alert broker-alert--ok">{notice}</div> : null}

      <form className="energy-actions__group" onSubmit={(event) => {
        event.preventDefault();
        if (!holderId || holderId === lead.energyHolderId) return;
        run(
          () => assignEnergyHolder(lead.id, holderId),
          `${isAssigned ? 'Neu zugewiesen' : 'Zugewiesen'} an ${selected?.fullName || 'Partner'}.`,
        );
      }}>
        <label className="energy-actions__label" htmlFor={`energy-holder-${lead.id}`}>
          {isAssigned ? 'Zuweisung ändern' : 'Zuweisen an'}
        </label>
        {partnersState === 'error' ? (
          <div className="energy-actions__empty is-error">
            <span>{partnersError}</span>
            <button type="button" className="broker-text-btn" onClick={loadPartners}>Erneut laden</button>
          </div>
        ) : partnersState === 'ready' && assignable.length === 0 ? (
          <div className="energy-actions__empty">
            <span>Noch keine aktiven Unterpartner oder Außendienst-Zugänge.</span>
            {role === 'main' ? <Link className="broker-text-btn" to="/dashboard/team">Partner anlegen</Link> : null}
          </div>
        ) : (
          <div className="energy-actions__row energy-actions__row--inline">
            <select
              id={`energy-holder-${lead.id}`}
              className="energy-actions__control"
              value={holderId}
              onChange={(event) => {
                setHolderId(event.target.value);
                setNotice('');
              }}
              disabled={busy || partnersState === 'loading'}
              required
            >
              <option value="">
                {partnersState === 'loading' ? 'Wird geladen…' : 'Partner wählen'}
              </option>
              {assignable.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.fullName} · {ENERGY_ROLE_LABELS[partner.energyRole] || partner.energyRole}
                  {partner.id === lead.energyHolderId ? ' (aktuell)' : ''}
                  {partner.active === false ? ' – inaktiv' : ''}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary energy-actions__submit"
              type="submit"
              disabled={busy || !holderId || holderId === lead.energyHolderId}
              title={isAssigned ? 'Neu zuweisen' : 'Zuweisen'}
            >
              <UserPlus size={16} aria-hidden="true" />
              {busy ? '…' : 'Zuweisen'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function emptyPartnerForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    energyRole: 'sub_partner',
  };
}

function PartnerPageAccess({ pages, disabled, onChange }) {
  return (
    <div className="energy-partner-pages" role="group" aria-label="Seitenzugriff">
      {ENERGY_PAGE_OPTIONS.map((option) => {
        const checked = pages.includes(option.id);
        return (
          <label key={option.id} className={`energy-partner-page${checked ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                const next = checked
                  ? pages.filter((id) => id !== option.id)
                  : [...pages, option.id];
                onChange(next.length ? next : ['dashboard']);
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function EnergyPartners() {
  const [partners, setPartners] = useState([]);
  const [form, setForm] = useState(emptyPartnerForm);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [accessPartner, setAccessPartner] = useState(null);
  const [accessPages, setAccessPages] = useState([]);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const load = () => fetchEnergyPartners().then((payload) => {
    setPartners(payload.partners || []);
  }).catch((err) => setError(err.message));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showCreate && !accessPartner) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (creating || savingAccess) return;
      if (showCreate) {
        setShowCreate(false);
        setFormError('');
        setForm(emptyPartnerForm());
      }
      if (accessPartner) {
        setAccessPartner(null);
        setAccessError('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreate, accessPartner, creating, savingAccess]);

  const accepted = partners.filter((item) => item.inviteStatus === 'accepted');
  const pending = partners.filter((item) => item.inviteStatus !== 'accepted');
  const activeCount = partners.filter((item) => item.active !== false).length;
  const visible = partners.filter((item) => {
    if (filter === 'accepted') return item.inviteStatus === 'accepted';
    if (filter === 'pending') return item.inviteStatus !== 'accepted';
    if (filter === 'active') return item.active !== false;
    if (filter === 'inactive') return item.active === false;
    return true;
  });

  const closeCreate = () => {
    if (creating) return;
    setShowCreate(false);
    setFormError('');
    setForm(emptyPartnerForm());
  };

  const openAccess = (partner) => {
    const pages = Array.isArray(partner.pages) && partner.pages.length
      ? partner.pages
      : ENERGY_DEFAULT_PAGE_IDS;
    setAccessError('');
    setAccessPages([...pages]);
    setAccessPartner(partner);
  };

  const closeAccess = () => {
    if (savingAccess) return;
    setAccessPartner(null);
    setAccessError('');
  };

  const patchPartner = async (partnerId, patch) => {
    setError('');
    setBusyId(partnerId);
    try {
      const payload = await updateEnergyPartner(partnerId, patch);
      setPartners((list) => list.map((item) => (item.id === partnerId ? { ...item, ...payload.partner } : item)));
      return payload.partner;
    } catch (err) {
      setError(err.message);
      await load();
      throw err;
    } finally {
      setBusyId('');
    }
  };

  const createModal = showCreate ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-create-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={closeCreate} />
      <div className="broker-modal__panel energy-partner-create-modal">
        <div className="energy-partner-create-head">
          <div className="energy-partner-create-title">
            <span className="energy-partner-create-icon" aria-hidden="true">
              <UserPlus size={20} />
            </span>
            <div>
              <h2 id="energy-partner-create-title">Zugang anlegen</h2>
              <p>Partner erhält Zugangsdaten per E-Mail und Passwort.</p>
            </div>
          </div>
          <button type="button" className="energy-partner-create-close" aria-label="Schließen" disabled={creating} onClick={closeCreate}>
            <X size={18} />
          </button>
        </div>

        <form
          className="energy-partner-create-body"
          onSubmit={async (event) => {
            event.preventDefault();
            setFormError('');
            setError('');
            setCreating(true);
            try {
              const payload = await createEnergyPartner({
                ...form,
                pages: [...ENERGY_DEFAULT_PAGE_IDS],
              });
              setCreated(payload);
              setForm(emptyPartnerForm());
              setShowCreate(false);
              await load();
            } catch (err) {
              setFormError(err.message);
            } finally {
              setCreating(false);
            }
          }}
        >
          {formError ? <div className="broker-alert">{formError}</div> : null}

          <div className="energy-partner-create-grid">
            <label className="energy-partner-create-field">
              <span>Vorname</span>
              <input
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                placeholder="Max"
                required
                autoFocus
              />
            </label>
            <label className="energy-partner-create-field">
              <span>Nachname</span>
              <input
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                placeholder="Mustermann"
                required
              />
            </label>
            <label className="energy-partner-create-field is-full">
              <span>E-Mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="partner@firma.de"
                required
              />
            </label>
          </div>

          <div className="energy-partner-create-roles" role="radiogroup" aria-label="Rolle">
            <span className="energy-partner-create-label">Rolle</span>
            {[
              { id: 'dispatcher', title: 'Dispatcher', hint: 'Zuweisung und Koordination' },
              { id: 'sub_partner', title: 'Untervertriebspartner', hint: 'Verkauf und Betreuung' },
              { id: 'field_rep', title: 'Außendienst', hint: 'Termine vor Ort' },
            ].map((role) => (
              <button
                key={role.id}
                type="button"
                role="radio"
                aria-checked={form.energyRole === role.id}
                className={`energy-partner-create-role${form.energyRole === role.id ? ' is-active' : ''}`}
                onClick={() => setForm({ ...form, energyRole: role.id })}
              >
                <strong>{role.title}</strong>
                <small>{role.hint}</small>
              </button>
            ))}
          </div>

          <div className="energy-partner-create-note">
            Standardzugriff: Dashboard, Leads, Kalender, Akademie, Support.
            <em>Meine Pakete</em> kann später freigegeben werden.
          </div>

          <div className="energy-partner-create-footer">
            <button type="button" className="dash-btn dash-btn--ghost" disabled={creating} onClick={closeCreate}>Abbrechen</button>
            <button className="dash-btn" type="submit" disabled={creating}>
              <UserPlus size={16} />
              {creating ? 'Wird angelegt…' : 'Zugang anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const accessModal = accessPartner ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-access-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={closeAccess} />
      <div className="broker-modal__panel energy-partner-access-modal">
        <div className="broker-modal__top">
          <h2 id="energy-partner-access-title">Seitenzugriff</h2>
          <button type="button" className="broker-modal__close" aria-label="Schließen" disabled={savingAccess} onClick={closeAccess}>
            <X size={18} />
          </button>
        </div>
        <p className="energy-partner-create-lede">
          Für <strong>{accessPartner.fullName}</strong> festlegen, welche Seiten sichtbar sind.
        </p>
        {accessError ? <div className="broker-alert">{accessError}</div> : null}
        <PartnerPageAccess
          pages={accessPages}
          disabled={savingAccess}
          onChange={setAccessPages}
        />
        <div className="energy-partner-create-actions">
          <button type="button" className="dash-btn dash-btn--ghost" disabled={savingAccess} onClick={closeAccess}>Abbrechen</button>
          <button
            type="button"
            className="dash-btn"
            disabled={savingAccess}
            onClick={async () => {
              setAccessError('');
              setSavingAccess(true);
              try {
                await patchPartner(accessPartner.id, { pages: accessPages.length ? accessPages : ['dashboard'] });
                setAccessPartner(null);
              } catch (err) {
                setAccessError(err.message || 'Seitenzugriff konnte nicht gespeichert werden.');
              } finally {
                setSavingAccess(false);
              }
            }}
          >
            {savingAccess ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="eyebrow">Netzwerk</div>
          <h1>Partner</h1>
          <p className="lede">
            Zugänge anlegen, Einladungsstatus prüfen, Seitenzugriff freigeben und Partner aktivieren oder sperren.
          </p>
        </div>
      </div>

      <div className="broker-home-metrics broker-home-metrics--leads">
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>Gesamt</span><strong>{partners.length}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>Aktiv</span><strong>{activeCount}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>Angenommen</span><strong>{accepted.length}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>Ausstehend</span><strong>{pending.length}</strong></div>
        </article>
      </div>

      {error ? <div className="broker-alert">{error}</div> : null}
      {created ? (
        <div className="broker-alert broker-alert--ok">
          Zugang für <strong>{created.user.email}</strong> angelegt. Einmaliges Passwort: <code>{created.password}</code>
        </div>
      ) : null}

      <section className="broker-panel energy-partner-board">
        <div className="broker-panel-header energy-partner-board-header">
          <div>
            <h2>Alle Partner</h2>
            <p>{partners.length} Zugänge in Ihrem Netzwerk</p>
          </div>
          <button type="button" className="dash-btn" onClick={() => { setFormError(''); setShowCreate(true); }}>
            <UserPlus size={16} />
            Zugang anlegen
          </button>
        </div>

        <div className="energy-partner-toolbar">
          <div className="dash-seg" role="tablist" aria-label="Filter">
            {[
              { id: 'all', label: 'Alle', count: partners.length },
              { id: 'accepted', label: 'Angenommen', count: accepted.length },
              { id: 'pending', label: 'Ausstehend', count: pending.length },
              { id: 'active', label: 'Aktiv', count: activeCount },
              { id: 'inactive', label: 'Inaktiv', count: partners.length - activeCount },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                className={filter === option.id ? 'is-active' : undefined}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
                <em>{option.count}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="energy-partner-list">
          {visible.length === 0 ? (
            <div className="energy-partner-empty">Keine Partner in diesem Filter.</div>
          ) : visible.map((partner) => {
            const busy = busyId === partner.id;
            const pages = Array.isArray(partner.pages) && partner.pages.length
              ? partner.pages
              : ENERGY_DEFAULT_PAGE_IDS;
            const isAccepted = partner.inviteStatus === 'accepted';
            const isActive = partner.active !== false;
            const avatar = initials({
              firstName: partner.firstName,
              lastName: partner.lastName,
              fullName: partner.fullName,
            }) || '?';
            return (
              <article
                key={partner.id}
                className={`broker-panel energy-partner-card${isActive ? '' : ' is-inactive'}${busy ? ' is-busy' : ''}`}
              >
                <div className="energy-partner-avatar" aria-hidden="true">{avatar}</div>

                <div className="energy-partner-identity">
                  <div className="energy-partner-name">{partner.fullName}</div>
                  <a className="energy-partner-email" href={`mailto:${partner.email}`}>
                    <Mail size={13} />
                    {partner.email}
                  </a>
                  <div className="energy-partner-meta-row">
                    <span className="broker-lead-type">{ENERGY_ROLE_LABELS[partner.energyRole] || partner.energyRole}</span>
                    <span className={`broker-status${isAccepted ? '' : ' is-reported'}`}>
                      {isAccepted ? 'Angenommen' : 'Ausstehend'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="energy-partner-access-btn"
                  disabled={busy}
                  onClick={() => openAccess(partner)}
                >
                  <KeyRound size={15} />
                  <span>Seitenzugriff</span>
                  <em>{pages.length}/{ENERGY_PAGE_OPTIONS.length}</em>
                </button>

                <button
                  type="button"
                  className={`energy-partner-toggle${isActive ? ' is-on' : ''}`}
                  disabled={busy}
                  aria-pressed={isActive}
                  aria-label={isActive ? 'Zugang deaktivieren' : 'Zugang aktivieren'}
                  onClick={() => patchPartner(partner.id, { active: !isActive })}
                >
                  <span className="energy-partner-toggle-track" aria-hidden />
                  <span>{isActive ? 'Aktiv' : 'Inaktiv'}</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {createModal ? createPortal(createModal, document.body) : null}
      {accessModal ? createPortal(accessModal, document.body) : null}
    </div>
  );
}
