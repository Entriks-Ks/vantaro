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
import { L } from '../../lib/i18n';

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
        aria-label={L(`Weitere Aktionen für ${partner.fullName}`, `More actions for ${partner.fullName}`)}
        title={L('Weitere Aktionen', 'More actions')}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={15} />
      </button>
      {open ? (
        <div className="energy-partner-more-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => pick(onAccess)}>
            <KeyRound size={15} aria-hidden="true" />
            <span>{L('Seitenzugriff', 'Page access')}</span>
            <em>{pagesLabel}</em>
          </button>
          <div className="energy-partner-more-divider" role="separator" />
          <button type="button" role="menuitem" onClick={() => pick(onSendLink)}>
            <Mail size={15} aria-hidden="true" />
            <span>
              {pending ? L('Einladung erneut senden', 'Resend invitation') : L('Passwort-Link senden', 'Send password link')}
              <small>{L(`Per E-Mail an ${partner.email}`, `By email to ${partner.email}`)}</small>
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
        setPartnersError(err.message || L('Partner konnten nicht geladen werden.', 'Partners could not be loaded.'));
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
          <h2>{L('Bearbeitung durch', 'Handled by')}</h2>
          <p>{isAssigned
            ? L(`Aktuell bei ${holder?.fullName || 'einem Partner'}`, `Currently with ${holder?.fullName || 'a partner'}`)
            : L('Noch bei Ihrer Firma', 'Still with your company')}</p>
        </div>
      </div>
      {error ? <div className="broker-alert">{error}</div> : null}
      {notice ? <div className="broker-alert broker-alert--ok">{notice}</div> : null}

      <form className="energy-actions__group" onSubmit={(event) => {
        event.preventDefault();
        if (!holderId || holderId === lead.energyHolderId) return;
        run(
          () => assignLeadHolder(lead.id, holderId),
          L(
            `${isAssigned ? 'Neu zugewiesen' : 'Zugewiesen'} an ${selected?.fullName || 'Partner'}.`,
            `${isAssigned ? 'Reassigned' : 'Assigned'} to ${selected?.fullName || 'partner'}.`,
          ),
        );
      }}>
        <label className="energy-actions__label" htmlFor={`energy-holder-${lead.id}`}>
          {isAssigned ? L('Zuweisung ändern', 'Change assignment') : L('Zuweisen an', 'Assign to')}
        </label>
        {partnersState === 'error' ? (
          <div className="energy-actions__empty is-error">
            <span>{partnersError}</span>
            <button type="button" className="broker-text-btn" onClick={loadPartners}>{L('Erneut laden', 'Reload')}</button>
          </div>
        ) : partnersState === 'ready' && assignable.length === 0 ? (
          <div className="energy-actions__empty">
            <span>{L('Noch keine aktiven Partner-Zugänge.', 'No active partner accounts yet.')}</span>
            {role === 'main' ? <Link className="broker-text-btn" to={partnersPath(user?.vertical)}>{L('Partner einladen', 'Invite partner')}</Link> : null}
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
                {partnersState === 'loading' ? L('Wird geladen…', 'Loading…') : L('Partner wählen', 'Choose partner')}
              </option>
              {assignable.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.fullName} · {partnerRoleLabel(user?.vertical, partner.partnerRole)}
                  {partner.id === lead.energyHolderId ? L(' (aktuell)', ' (current)') : ''}
                  {partner.active === false ? L(' – inaktiv', ' – inactive') : ''}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary energy-actions__submit"
              type="submit"
              disabled={busy || !holderId || holderId === lead.energyHolderId}
              title={isAssigned ? L('Neu zuweisen', 'Reassign') : L('Zuweisen', 'Assign')}
            >
              <UserPlus size={16} aria-hidden="true" />
              {busy ? '…' : L('Zuweisen', 'Assign')}
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
    <div className="energy-partner-create-roles" role="radiogroup" aria-label={L('Rolle', 'Role')}>
      <span className="energy-partner-create-label">{L('Rolle', 'Role')}</span>
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
    <div className="energy-partner-pages" role="group" aria-label={L('Seitenzugriff', 'Page access')}>
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
        ? L(`Einladung wurde an ${partner.email} gesendet.`, `Invitation sent to ${partner.email}.`)
        : L(`Link zum Zurücksetzen des Passworts wurde an ${partner.email} gesendet.`, `A password reset link has been sent to ${partner.email}.`));
    } catch (err) {
      setError(err.message || (pending
        ? L('Einladung konnte nicht gesendet werden.', 'The invitation could not be sent.')
        : L('Passwort-Link konnte nicht gesendet werden.', 'The password link could not be sent.')));
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
        ? L(
          `${partner.fullName} wurde gelöscht. ${payload.unassignedLeads} Lead(s) liegen wieder bei Ihrer Firma.`,
          `${partner.fullName} has been deleted. ${payload.unassignedLeads} lead(s) are back with your company.`,
        )
        : L(`${partner.fullName} wurde gelöscht.`, `${partner.fullName} has been deleted.`));
    } catch (err) {
      setRemoveError(err.message || L('Zugang konnte nicht gelöscht werden.', 'The account could not be deleted.'));
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
      <button type="button" className="broker-modal__backdrop" aria-label={L('Schließen', 'Close')} onClick={closeCreate} />
      <div className="broker-modal__panel energy-partner-create-modal">
        <div className="energy-partner-create-head">
          <div className="energy-partner-create-title">
            <span className="energy-partner-create-icon" aria-hidden="true">
              <UserPlus size={20} />
            </span>
            <div>
              <h2 id="energy-partner-create-title">{L('Partner einladen', 'Invite partner')}</h2>
              <p>{L('Der Partner erhält eine E-Mail und legt selbst ein Passwort fest.', 'The partner receives an email and sets their own password.')}</p>
            </div>
          </div>
          <button type="button" className="energy-partner-create-close" aria-label={L('Schließen', 'Close')} disabled={creating} onClick={closeCreate}>
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
              <span>{L('Vorname', 'First name')}</span>
              <input
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                placeholder={L('Max', 'John')}
                required
                autoFocus
              />
            </label>
            <label className="energy-partner-create-field">
              <span>{L('Nachname', 'Last name')}</span>
              <input
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                placeholder={L('Mustermann', 'Smith')}
                required
              />
            </label>
            <label className="energy-partner-create-field is-full">
              <span>{L('E-Mail', 'Email')}</span>
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
            {L('Standardzugriff: Dashboard, Leads, Kalender, Akademie, Support.', 'Default access: Dashboard, Leads, Calendar, Academy, Support.')}
            {vertical === 'energy' ? <em>{L('Meine Pakete', 'My packages')}</em> : null}
            {vertical === 'energy' ? L(' kann später freigegeben werden.', ' can be enabled later.') : null}
          </div>

          <div className="energy-partner-create-footer">
            <button type="button" className="dash-btn dash-btn--ghost" disabled={creating} onClick={closeCreate}>{L('Abbrechen', 'Cancel')}</button>
            <button className="dash-btn" type="submit" disabled={creating}>
              <UserPlus size={16} />
              {creating ? L('Wird gesendet…', 'Sending…') : L('Einladung senden', 'Send invitation')}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const accessModal = accessPartner ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-access-title">
      <button type="button" className="broker-modal__backdrop" aria-label={L('Schließen', 'Close')} onClick={closeAccess} />
      <div className="broker-modal__panel energy-partner-access-modal">
        <div className="broker-modal__top">
          <h2 id="energy-partner-access-title">{L('Seitenzugriff', 'Page access')}</h2>
          <button type="button" className="broker-modal__close" aria-label={L('Schließen', 'Close')} disabled={savingAccess} onClick={closeAccess}>
            <X size={18} />
          </button>
        </div>
        <p className="energy-partner-create-lede">
          {L('Für ', 'Choose which pages are visible for ')}<strong>{accessPartner.fullName}</strong>{L(' festlegen, welche Seiten sichtbar sind.', '.')}
        </p>
        {accessError ? <div className="broker-alert">{accessError}</div> : null}
        <PartnerPageAccess
          vertical={vertical}
          pages={accessPages}
          disabled={savingAccess}
          onChange={setAccessPages}
        />
        <div className="energy-partner-create-actions">
          <button type="button" className="dash-btn dash-btn--ghost" disabled={savingAccess} onClick={closeAccess}>{L('Abbrechen', 'Cancel')}</button>
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
                setAccessError(err.message || L('Seitenzugriff konnte nicht gespeichert werden.', 'Page access could not be saved.'));
              } finally {
                setSavingAccess(false);
              }
            }}
          >
            {savingAccess ? L('Wird gespeichert…', 'Saving…') : L('Speichern', 'Save')}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const editModal = editPartner ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-edit-title">
      <button type="button" className="broker-modal__backdrop" aria-label={L('Schließen', 'Close')} onClick={closeEdit} />
      <div className="broker-modal__panel energy-partner-create-modal">
        <div className="energy-partner-create-head">
          <div className="energy-partner-create-title">
            <span className="energy-partner-create-icon" aria-hidden="true">
              <Pencil size={20} />
            </span>
            <div>
              <h2 id="energy-partner-edit-title">{L('Zugang bearbeiten', 'Edit account')}</h2>
              <p>{L(`Name, E-Mail und Rolle von ${editPartner.fullName} ändern.`, `Change the name, email and role of ${editPartner.fullName}.`)}</p>
            </div>
          </div>
          <button type="button" className="energy-partner-create-close" aria-label={L('Schließen', 'Close')} disabled={savingEdit} onClick={closeEdit}>
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
              setNotice(L(`${partner?.fullName || 'Zugang'} wurde aktualisiert.`, `${partner?.fullName || 'Account'} has been updated.`));
            } catch (err) {
              setError('');
              setEditError(err.message || L('Zugang konnte nicht gespeichert werden.', 'The account could not be saved.'));
            } finally {
              setSavingEdit(false);
            }
          }}
        >
          {editError ? <div className="broker-alert">{editError}</div> : null}

          <div className="energy-partner-create-grid">
            <label className="energy-partner-create-field">
              <span>{L('Vorname', 'First name')}</span>
              <input
                value={editForm.firstName}
                onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })}
                disabled={savingEdit}
                required
                autoFocus
              />
            </label>
            <label className="energy-partner-create-field">
              <span>{L('Nachname', 'Last name')}</span>
              <input
                value={editForm.lastName}
                onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })}
                disabled={savingEdit}
                required
              />
            </label>
            <label className="energy-partner-create-field is-full">
              <span>{L('E-Mail', 'Email')}</span>
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
            <button type="button" className="dash-btn dash-btn--ghost" disabled={savingEdit} onClick={closeEdit}>{L('Abbrechen', 'Cancel')}</button>
            <button className="dash-btn" type="submit" disabled={savingEdit}>
              {savingEdit ? L('Wird gespeichert…', 'Saving…') : L('Speichern', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const removeModal = removePartner ? (
    <div className="broker-modal" role="dialog" aria-modal="true" aria-labelledby="energy-partner-remove-title">
      <button type="button" className="broker-modal__backdrop" aria-label={L('Schließen', 'Close')} onClick={closeRemove} />
      <div className="broker-modal__panel energy-partner-access-modal">
        <div className="broker-modal__top">
          <h2 id="energy-partner-remove-title">{L('Zugang löschen', 'Delete account')}</h2>
          <button type="button" className="broker-modal__close" aria-label={L('Schließen', 'Close')} disabled={removing} onClick={closeRemove}>
            <X size={18} />
          </button>
        </div>
        <p className="energy-partner-create-lede">
          {L('Soll der Zugang von ', 'Permanently delete the account of ')}<strong>{removePartner.fullName}</strong> ({removePartner.email}){L(' endgültig gelöscht werden?', '?')}
          {' '}{L('Zugewiesene Leads gehen an Ihre Firma zurück. Dies kann nicht rückgängig gemacht werden.', 'Assigned leads go back to your company. This cannot be undone.')}
        </p>
        {removeError ? <div className="broker-alert">{removeError}</div> : null}
        <div className="energy-partner-create-actions">
          <button type="button" className="dash-btn dash-btn--ghost" disabled={removing} onClick={closeRemove}>{L('Abbrechen', 'Cancel')}</button>
          <button type="button" className="dash-btn dash-btn--danger" disabled={removing} onClick={confirmRemove}>
            <Trash2 size={16} />
            {removing ? L('Wird gelöscht…', 'Deleting…') : L('Endgültig löschen', 'Delete permanently')}
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
      <button type="button" className="broker-modal__backdrop" aria-label={L('Schließen', 'Close')} onClick={() => setViewPartnerId('')} />
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
                  {viewPartner.inviteStatus === 'accepted' ? L('Angenommen', 'Accepted') : L('Ausstehend', 'Pending')}
                </span>
              </div>
            </div>
          </div>
          <button type="button" className="energy-partner-create-close" aria-label={L('Schließen', 'Close')} onClick={() => setViewPartnerId('')}>
            <X size={18} />
          </button>
        </div>

        <div className="energy-partner-create-body">
          <dl className="energy-partner-view-grid">
            <div>
              <dt>{L('Vorname', 'First name')}</dt>
              <dd>{viewPartner.firstName || '—'}</dd>
            </div>
            <div>
              <dt>{L('Nachname', 'Last name')}</dt>
              <dd>{viewPartner.lastName || '—'}</dd>
            </div>
            <div className="is-full">
              <dt>{L('E-Mail', 'Email')}</dt>
              <dd><a href={`mailto:${viewPartner.email}`}>{viewPartner.email}</a></dd>
            </div>
            <div>
              <dt>{L('Rolle', 'Role')}</dt>
              <dd>
                {partnerRoleLabel(vertical, viewPartner.partnerRole)}
                {viewRole?.hint ? <small>{viewRole.hint}</small> : null}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={viewPartner.active !== false ? 'is-ok' : 'is-muted'}>
                {viewPartner.active !== false ? L('Aktiv', 'Active') : L('Inaktiv', 'Inactive')}
              </dd>
            </div>
            <div>
              <dt>{L('Angelegt am', 'Created on')}</dt>
              <dd>{formatDateTime(viewPartner.createdAt)}</dd>
            </div>
            <div>
              <dt>{L('Letzte Anmeldung', 'Last sign-in')}</dt>
              <dd>{viewPartner.lastSignInAt ? formatDateTime(viewPartner.lastSignInAt) : L('Noch nie', 'Never')}</dd>
            </div>
          </dl>

          <div className="energy-partner-view-pages">
            <span className="energy-partner-view-label">
              {L('Seitenzugriff', 'Page access')} · {viewPages.filter((id) => pageOptions.some((option) => option.id === id)).length}/{pageOptions.length}
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
            <button type="button" className="dash-btn dash-btn--ghost" onClick={() => setViewPartnerId('')}>{L('Schließen', 'Close')}</button>
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
              {L('Bearbeiten', 'Edit')}
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
          <div className="eyebrow">{L('Netzwerk', 'Network')}</div>
          <h1>{L('Partner', 'Partners')}</h1>
          <p className="lede">
          {L('Zugänge einladen, bearbeiten und löschen, Einladungsstatus prüfen, Seitenzugriff freigeben und Partner aktivieren oder sperren.', 'Invite, edit and delete accounts, check invitation status, grant page access and activate or block partners.')}
          </p>
        </div>
      </div>

      <div className="broker-home-metrics broker-home-metrics--leads">
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>{L('Gesamt', 'Total')}</span><strong>{partners.length}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>{L('Aktiv', 'Active')}</span><strong>{activeCount}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>{L('Angenommen', 'Accepted')}</span><strong>{accepted.length}</strong></div>
        </article>
        <article className="broker-home-metric">
          <div className="broker-home-metric-body"><span>{L('Ausstehend', 'Pending')}</span><strong>{pending.length}</strong></div>
        </article>
      </div>

      {error ? <div className="broker-alert">{error}</div> : null}
      {notice ? <div className="broker-alert broker-alert--ok">{notice}</div> : null}
      {created ? (
        <div className="broker-alert broker-alert--ok">
          {L(`Einladung wurde an ${created.user.email} gesendet.`, `Invitation sent to ${created.user.email}.`)}
        </div>
      ) : null}

      <section className="broker-panel energy-partner-board">
        <div className="broker-panel-header energy-partner-board-header">
          <div>
            <h2>{L('Alle Partner', 'All partners')}</h2>
            <p>{L(`${partners.length} Zugänge in Ihrem Netzwerk`, `${partners.length} accounts in your network`)}</p>
          </div>
          <button type="button" className="dash-btn" onClick={() => { setFormError(''); setShowCreate(true); }}>
            <UserPlus size={16} />
            {L('Partner einladen', 'Invite partner')}
          </button>
        </div>

        <div className="energy-partner-toolbar">
          <div className="dash-seg" role="tablist" aria-label="Filter">
            {[
              { id: 'all', label: L('Alle', 'All'), count: partners.length },
              { id: 'accepted', label: L('Angenommen', 'Accepted'), count: accepted.length },
              { id: 'pending', label: L('Ausstehend', 'Pending'), count: pending.length },
              { id: 'active', label: L('Aktiv', 'Active'), count: activeCount },
              { id: 'inactive', label: L('Inaktiv', 'Inactive'), count: partners.length - activeCount },
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
            <div className="energy-partner-empty">{L('Partner werden geladen…', 'Loading partners…')}</div>
          ) : loadState === 'error' ? (
            <div className="energy-partner-empty">
              {L('Partner konnten nicht geladen werden.', 'Partners could not be loaded.')}{' '}
              <button
                type="button"
                className="broker-text-btn"
                onClick={() => { setError(''); setLoadState('loading'); load(); }}
              >
                {L('Erneut laden', 'Reload')}
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="energy-partner-empty">{L('Keine Partner in diesem Filter.', 'No partners in this filter.')}</div>
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
                  aria-label={isActive ? L('Zugang deaktivieren', 'Deactivate account') : L('Zugang aktivieren', 'Activate account')}
                  onClick={() => patchPartner(partner.id, { active: !isActive })}
                >
                  <span className="energy-partner-toggle-track" aria-hidden />
                  <span>{isActive ? L('Aktiv', 'Active') : L('Inaktiv', 'Inactive')}</span>
                </button>

                <div className="energy-partner-card-actions">
                  <button
                    type="button"
                    className="energy-partner-icon-btn"
                    aria-label={L(`${partner.fullName} ansehen`, `View ${partner.fullName}`)}
                    title={L('Ansehen', 'View')}
                    onClick={() => setViewPartnerId(partner.id)}
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    type="button"
                    className="energy-partner-icon-btn"
                    disabled={busy}
                    aria-label={L(`${partner.fullName} bearbeiten`, `Edit ${partner.fullName}`)}
                    title={L('Bearbeiten', 'Edit')}
                    onClick={() => openEdit(partner)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="energy-partner-icon-btn is-danger"
                    disabled={busy}
                    aria-label={L(`${partner.fullName} löschen`, `Delete ${partner.fullName}`)}
                    title={L('Löschen', 'Delete')}
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
