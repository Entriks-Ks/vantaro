import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Check,
  Eye,
  KeyRound,
  Mail,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  DEFAULT_PARTNER_PAGE_IDS,
  assignLeadHolder,
  createPartner,
  deletePartner,
  fetchPartners,
  partnerPageOptions,
  partnerRoleLabel,
  partnerRoleOptions,
  sendPartnerPasswordLink,
  updatePartner,
} from '../../lib/partners';
import { formatDateTime, initials } from './helpers';

export function partnersPath(vertical) {
  return vertical === 'energy' ? '/dashboard/team' : '/dashboard/partner';
}

function PartnerMoreMenu({ partner, pagesLabel, disabled, onAccess, onSendLink }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const pending = partner.inviteStatus !== 'accepted';

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const pick = (action) => {
    setOpen(false);
    action();
  };

  return (
    <div className="energy-partner-more" ref={wrapRef}>
      <button
        type="button"
        className={`energy-partner-icon-btn${open ? ' is-open' : ''}`}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Weitere Aktionen für ${partner.fullName}`}
        title="Weitere Aktionen"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={15} />
      </button>
      {open ? (
        <div className="energy-partner-more-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => pick(onAccess)}>
            <KeyRound size={15} aria-hidden="true" />
            <span>Seitenzugriff</span>
            <em>{pagesLabel}</em>
          </button>
          <div className="energy-partner-more-divider" role="separator" />
          <button type="button" role="menuitem" onClick={() => pick(onSendLink)}>
            <Mail size={15} aria-hidden="true" />
            <span>
              {pending ? 'Einladung erneut senden' : 'Passwort-Link senden'}
              <small>Per E-Mail an {partner.email}</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PartnerLeadActions({ lead, onChange }) {
  const { user, isAdmin } = useAuth();
  const role = user?.partnerRole || 'main';
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
    fetchPartners()
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
          () => assignLeadHolder(lead.id, holderId),
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
            <span>Noch keine aktiven Partner-Zugänge.</span>
            {role === 'main' ? <Link className="broker-text-btn" to={partnersPath(user?.vertical)}>Partner einladen</Link> : null}
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
                  {partner.fullName} · {partnerRoleLabel(user?.vertical, partner.partnerRole)}
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
    partnerRole: 'sub_partner',
  };
}

function PartnerRolePicker({ vertical, value, disabled, onChange }) {
  return (
    <div className="energy-partner-create-roles" role="radiogroup" aria-label="Rolle">
      <span className="energy-partner-create-label">Rolle</span>
      {partnerRoleOptions(vertical).map((role) => (
        <button
          key={role.id}
          type="button"
          role="radio"
          aria-checked={value === role.id}
          disabled={disabled}
          className={`energy-partner-create-role${value === role.id ? ' is-active' : ''}`}
          onClick={() => onChange(role.id)}
        >
          <strong>{role.title}</strong>
          <small>{role.hint}</small>
        </button>
      ))}
    </div>
  );
}

function PartnerPageAccess({ vertical, pages, disabled, onChange }) {
  return (
    <div className="energy-partner-pages" role="group" aria-label="Seitenzugriff">
      {partnerPageOptions(vertical).map((option) => {
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

export function PartnersPage() {
  const { user } = useAuth();
  const vertical = user?.vertical === 'energy' ? 'energy' : 'insurance';
  const pageOptions = partnerPageOptions(vertical);
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
  const [editPartner, setEditPartner] = useState(null);
  const [editForm, setEditForm] = useState(emptyPartnerForm);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [removePartner, setRemovePartner] = useState(null);
  const [removeError, setRemoveError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [viewPartnerId, setViewPartnerId] = useState('');
  const [notice, setNotice] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const viewPartner = viewPartnerId ? partners.find((item) => item.id === viewPartnerId) || null : null;

  const load = () => fetchPartners().then((payload) => {
    setPartners(payload.partners || []);
    setLoadState('ready');
  }).catch((err) => {
    setError(err.message);
    setLoadState('error');
  });

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showCreate && !accessPartner && !editPartner && !removePartner && !viewPartnerId) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (creating || savingAccess || savingEdit || removing) return;
      if (viewPartnerId) setViewPartnerId('');
      if (showCreate) {
        setShowCreate(false);
        setFormError('');
        setForm(emptyPartnerForm());
      }
      if (accessPartner) {
        setAccessPartner(null);
        setAccessError('');
      }
      if (editPartner) {
        setEditPartner(null);
        setEditError('');
      }
      if (removePartner) {
        setRemovePartner(null);
        setRemoveError('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreate, accessPartner, editPartner, removePartner, viewPartnerId, creating, savingAccess, savingEdit, removing]);

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
      : DEFAULT_PARTNER_PAGE_IDS;
    setAccessError('');
    setAccessPages([...pages]);
    setAccessPartner(partner);
  };

  const closeAccess = () => {
    if (savingAccess) return;
    setAccessPartner(null);
    setAccessError('');
  };

  const openEdit = (partner) => {
    const [first = '', ...rest] = String(partner.fullName || '').split(' ');
    setEditError('');
    setEditForm({
      firstName: partner.firstName || first,
      lastName: partner.lastName || rest.join(' '),
      email: partner.email || '',
      partnerRole: partner.partnerRole || 'sub_partner',
    });
    setEditPartner(partner);
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditPartner(null);
    setEditError('');
  };

  const sendPasswordLink = async (partner) => {
    setError('');
    setNotice('');
    setBusyId(partner.id);
    const pending = partner.inviteStatus !== 'accepted';
    try {
      await sendPartnerPasswordLink(partner.id);
      setNotice(pending
        ? `Invitation sent to ${partner.email}`
        : `Link zum Zurücksetzen des Passworts wurde an ${partner.email} gesendet.`);
    } catch (err) {
      setError(err.message || (pending ? 'Einladung konnte nicht gesendet werden.' : 'Passwort-Link konnte nicht gesendet werden.'));
    } finally {
      setBusyId('');
    }
  };

  const openRemove = (partner) => {
    setRemoveError('');
    setRemovePartner(partner);
  };

  const closeRemove = () => {
    if (removing) return;
    setRemovePartner(null);
    setRemoveError('');
  };

  const confirmRemove = async () => {
    const partner = removePartner;
    setRemoveError('');
    setError('');
    setNotice('');
    setRemoving(true);
    setBusyId(partner.id);
    try {
      const payload = await deletePartner(partner.id);
      setPartners((list) => list.filter((item) => item.id !== partner.id));
      if (created?.user?.id === partner.id) setCreated(null);
      setRemovePartner(null);
      setNotice(payload.unassignedLeads
        ? `${partner.fullName} wurde gelöscht. ${payload.unassignedLeads} Lead(s) liegen wieder bei Ihrer Firma.`
        : `${partner.fullName} wurde gelöscht.`);
    } catch (err) {
      setRemoveError(err.message || 'Zugang konnte nicht gelöscht werden.');
    } finally {
      setRemoving(false);
      setBusyId('');
    }
  };

  const patchPartner = async (partnerId, patch) => {
    setError('');
    setBusyId(partnerId);
    try {
      const payload = await updatePartner(partnerId, patch);
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
              <h2 id="energy-partner-create-title">Partner einladen</h2>
              <p>Der Partner erhält eine E-Mail und legt selbst ein Passwort fest.</p>
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
              const payload = await createPartner({
                ...form,
                pages: [...DEFAULT_PARTNER_PAGE_IDS],
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

          <PartnerRolePicker
            vertical={vertical}
            value={form.partnerRole}
            disabled={creating}
            onChange={(partnerRole) => setForm({ ...form, partnerRole })}
          />

          <div className="energy-partner-create-note">
            Standardzugriff: Dashboard, Leads, Kalender, Akademie, Support.
            {vertical === 'energy' ? <em>Meine Pakete</em> : null}
            {vertical === 'energy' ? ' kann später freigegeben werden.' : null}
          </div>

          <div className="energy-partner-create-footer">
            <button type="button" className="dash-btn dash-btn--ghost" disabled={creating} onClick={closeCreate}>Abbrechen</button>
            <button className="dash-btn" type="submit" disabled={creating}>
              <UserPlus size={16} />
              {creating ? 'Wird gesendet…' : 'Einladung senden'}
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
          vertical={vertical}
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

  const editModal = editPartner ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-edit-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={closeEdit} />
      <div className="broker-modal__panel energy-partner-create-modal">
        <div className="energy-partner-create-head">
          <div className="energy-partner-create-title">
            <span className="energy-partner-create-icon" aria-hidden="true">
              <Pencil size={20} />
            </span>
            <div>
              <h2 id="energy-partner-edit-title">Zugang bearbeiten</h2>
              <p>Name, E-Mail und Rolle von {editPartner.fullName} ändern.</p>
            </div>
          </div>
          <button type="button" className="energy-partner-create-close" aria-label="Schließen" disabled={savingEdit} onClick={closeEdit}>
            <X size={18} />
          </button>
        </div>

        <form
          className="energy-partner-create-body"
          onSubmit={async (event) => {
            event.preventDefault();
            setEditError('');
            setNotice('');
            setSavingEdit(true);
            try {
              const partner = await patchPartner(editPartner.id, editForm);
              setEditPartner(null);
              setNotice(`${partner?.fullName || 'Zugang'} wurde aktualisiert.`);
            } catch (err) {
              setError('');
              setEditError(err.message || 'Zugang konnte nicht gespeichert werden.');
            } finally {
              setSavingEdit(false);
            }
          }}
        >
          {editError ? <div className="broker-alert">{editError}</div> : null}

          <div className="energy-partner-create-grid">
            <label className="energy-partner-create-field">
              <span>Vorname</span>
              <input
                value={editForm.firstName}
                onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })}
                disabled={savingEdit}
                required
                autoFocus
              />
            </label>
            <label className="energy-partner-create-field">
              <span>Nachname</span>
              <input
                value={editForm.lastName}
                onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })}
                disabled={savingEdit}
                required
              />
            </label>
            <label className="energy-partner-create-field is-full">
              <span>E-Mail</span>
              <input
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                disabled={savingEdit}
                required
              />
            </label>
          </div>

          <PartnerRolePicker
            vertical={vertical}
            value={editForm.partnerRole}
            disabled={savingEdit}
            onChange={(partnerRole) => setEditForm({ ...editForm, partnerRole })}
          />

          <div className="energy-partner-create-footer">
            <button type="button" className="dash-btn dash-btn--ghost" disabled={savingEdit} onClick={closeEdit}>Abbrechen</button>
            <button className="dash-btn" type="submit" disabled={savingEdit}>
              {savingEdit ? 'Wird gespeichert…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const removeModal = removePartner ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-remove-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={closeRemove} />
      <div className="broker-modal__panel energy-partner-access-modal">
        <div className="broker-modal__top">
          <h2 id="energy-partner-remove-title">Zugang löschen</h2>
          <button type="button" className="broker-modal__close" aria-label="Schließen" disabled={removing} onClick={closeRemove}>
            <X size={18} />
          </button>
        </div>
        <p className="energy-partner-create-lede">
          Soll der Zugang von <strong>{removePartner.fullName}</strong> ({removePartner.email}) endgültig gelöscht werden?
          Zugewiesene Leads gehen an Ihre Firma zurück. Dies kann nicht rückgängig gemacht werden.
        </p>
        {removeError ? <div className="broker-alert">{removeError}</div> : null}
        <div className="energy-partner-create-actions">
          <button type="button" className="dash-btn dash-btn--ghost" disabled={removing} onClick={closeRemove}>Abbrechen</button>
          <button type="button" className="dash-btn dash-btn--danger" disabled={removing} onClick={confirmRemove}>
            <Trash2 size={16} />
            {removing ? 'Wird gelöscht…' : 'Endgültig löschen'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const viewPages = viewPartner
    ? (Array.isArray(viewPartner.pages) && viewPartner.pages.length ? viewPartner.pages : DEFAULT_PARTNER_PAGE_IDS)
    : [];
  const viewRole = viewPartner
    ? partnerRoleOptions(vertical).find((option) => option.id === viewPartner.partnerRole)
    : null;
  const viewModal = viewPartner ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-view-title">
      <button type="button" className="broker-modal__backdrop" aria-label="Schließen" onClick={() => setViewPartnerId('')} />
      <div className="broker-modal__panel energy-partner-create-modal">
        <div className="energy-partner-create-head">
          <div className="energy-partner-create-title">
            <span className="energy-partner-create-icon energy-partner-view-avatar" aria-hidden="true">
              {initials({
                firstName: viewPartner.firstName,
                lastName: viewPartner.lastName,
                fullName: viewPartner.fullName,
              }) || '?'}
            </span>
            <div>
              <h2 id="energy-partner-view-title">{viewPartner.fullName}</h2>
              <div className="energy-partner-meta-row">
                <span className="broker-lead-type">{partnerRoleLabel(vertical, viewPartner.partnerRole)}</span>
                <span className={`broker-status${viewPartner.inviteStatus === 'accepted' ? '' : ' is-reported'}`}>
                  {viewPartner.inviteStatus === 'accepted' ? 'Angenommen' : 'Ausstehend'}
                </span>
              </div>
            </div>
          </div>
          <button type="button" className="energy-partner-create-close" aria-label="Schließen" onClick={() => setViewPartnerId('')}>
            <X size={18} />
          </button>
        </div>

        <div className="energy-partner-create-body">
          <dl className="energy-partner-view-grid">
            <div>
              <dt>Vorname</dt>
              <dd>{viewPartner.firstName || '—'}</dd>
            </div>
            <div>
              <dt>Nachname</dt>
              <dd>{viewPartner.lastName || '—'}</dd>
            </div>
            <div className="is-full">
              <dt>E-Mail</dt>
              <dd><a href={`mailto:${viewPartner.email}`}>{viewPartner.email}</a></dd>
            </div>
            <div>
              <dt>Rolle</dt>
              <dd>
                {partnerRoleLabel(vertical, viewPartner.partnerRole)}
                {viewRole?.hint ? <small>{viewRole.hint}</small> : null}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={viewPartner.active !== false ? 'is-ok' : 'is-muted'}>
                {viewPartner.active !== false ? 'Aktiv' : 'Inaktiv'}
              </dd>
            </div>
            <div>
              <dt>Angelegt am</dt>
              <dd>{formatDateTime(viewPartner.createdAt)}</dd>
            </div>
            <div>
              <dt>Letzte Anmeldung</dt>
              <dd>{viewPartner.lastSignInAt ? formatDateTime(viewPartner.lastSignInAt) : 'Noch nie'}</dd>
            </div>
          </dl>

          <div className="energy-partner-view-pages">
            <span className="energy-partner-view-label">
              Seitenzugriff · {viewPages.filter((id) => pageOptions.some((option) => option.id === id)).length}/{pageOptions.length}
            </span>
            <div>
              {pageOptions.map((option) => {
                const granted = viewPages.includes(option.id);
                return (
                  <span key={option.id} className={`energy-partner-view-page${granted ? ' is-on' : ''}`}>
                    {granted ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
                    {option.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="energy-partner-create-footer">
            <button type="button" className="dash-btn dash-btn--ghost" onClick={() => setViewPartnerId('')}>Schließen</button>
            <button
              type="button"
              className="dash-btn"
              onClick={() => {
                const partner = viewPartner;
                setViewPartnerId('');
                openEdit(partner);
              }}
            >
              <Pencil size={16} />
              Bearbeiten
            </button>
          </div>
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
          Zugänge einladen, bearbeiten und löschen, Einladungsstatus prüfen, Seitenzugriff freigeben und Partner aktivieren oder sperren.
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
      {notice ? <div className="broker-alert broker-alert--ok">{notice}</div> : null}
      {created ? (
        <div className="broker-alert broker-alert--ok">
          Invitation sent to {created.user.email}
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
            Partner einladen
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
          {loadState === 'loading' ? (
            <div className="energy-partner-empty">Partner werden geladen…</div>
          ) : loadState === 'error' ? (
            <div className="energy-partner-empty">
              Partner konnten nicht geladen werden.{' '}
              <button
                type="button"
                className="broker-text-btn"
                onClick={() => { setError(''); setLoadState('loading'); load(); }}
              >
                Erneut laden
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="energy-partner-empty">Keine Partner in diesem Filter.</div>
          ) : visible.map((partner) => {
            const busy = busyId === partner.id;
            const pages = Array.isArray(partner.pages) && partner.pages.length
              ? partner.pages
              : DEFAULT_PARTNER_PAGE_IDS;
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
                </div>

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

                <div className="energy-partner-card-actions">
                  <button
                    type="button"
                    className="energy-partner-icon-btn"
                    aria-label={`${partner.fullName} ansehen`}
                    title="Ansehen"
                    onClick={() => setViewPartnerId(partner.id)}
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    type="button"
                    className="energy-partner-icon-btn"
                    disabled={busy}
                    aria-label={`${partner.fullName} bearbeiten`}
                    title="Bearbeiten"
                    onClick={() => openEdit(partner)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="energy-partner-icon-btn is-danger"
                    disabled={busy}
                    aria-label={`${partner.fullName} löschen`}
                    title="Löschen"
                    onClick={() => openRemove(partner)}
                  >
                    <Trash2 size={15} />
                  </button>
                  <PartnerMoreMenu
                    partner={partner}
                    disabled={busy}
                    pagesLabel={`${pages.filter((id) => pageOptions.some((option) => option.id === id)).length}/${pageOptions.length}`}
                    onAccess={() => openAccess(partner)}
                    onSendLink={() => sendPasswordLink(partner)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {createModal ? createPortal(createModal, document.body) : null}
      {accessModal ? createPortal(accessModal, document.body) : null}
      {editModal ? createPortal(editModal, document.body) : null}
      {removeModal ? createPortal(removeModal, document.body) : null}
      {viewModal ? createPortal(viewModal, document.body) : null}
    </div>
  );
}
