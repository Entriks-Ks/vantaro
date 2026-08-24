import { useEffect, useMemo, useState } from 'react';
import PhoneField, { isValidMobile } from '../../components/PhoneField';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
import { LEGAL_FORMS, fileToAvatarDataUrl, formatAddress } from '../../lib/profile';
import { formatEuroExact } from './helpers';
import { formatDistance, LEADS, PRODUCT_FILTERS } from './leads';

function LeadCard({ lead }) {
  return (
    <article className="broker-panel broker-lead-card" id={`lead-${lead.id}`}>
      <div className="broker-lead-top">
        <div>
          <div className="broker-lead-name">{lead.name}</div>
          <div className="broker-lead-address">⌖ {lead.address}</div>
        </div>
        <span className="broker-status">Gekauft</span>
      </div>
      <div className="broker-lead-meta">
        <span>{formatDistance(lead.distanceKm)} entfernt</span>
        <span>{lead.product}</span>
        <span>Exklusiv</span>
      </div>
      <p className="broker-lead-note">{lead.note}</p>
      <div className="broker-lead-bottom">
        <div className="broker-lead-price">
          {formatEuroExact(lead.priceCents)}
          <span>bezahlt</span>
        </div>
        <span className="broker-muted-action">Nächster Schritt: Kontakt aufnehmen</span>
      </div>
    </article>
  );
}

export function BeraterLeads() {
  const { purchasedIds } = useBroker();
  const [product, setProduct] = useState('all');

  const visible = useMemo(() => (
    LEADS
      .filter((lead) => purchasedIds.includes(lead.id))
      .filter((lead) => product === 'all' || lead.product === product)
  ), [product, purchasedIds]);

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="broker-eyebrow">Gekaufte Chancen</div>
          <h1>Meine Leads</h1>
          <p>Leads, die Sie übernommen haben und jetzt kontaktieren können.</p>
        </div>
      </div>

      <div className="broker-filterbar">
        <label htmlFor="productFilter">Produkt</label>
        <select id="productFilter" value={product} onChange={(event) => setProduct(event.target.value)}>
          {PRODUCT_FILTERS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <span className="broker-filter-count">{visible.length} in Ihrem Bestand</span>
      </div>

      {visible.length ? (
        <div className="broker-leads-grid">
          {visible.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      ) : (
        <div className="broker-panel broker-empty">
          <strong>Noch keine Leads gekauft</strong>
          <p>Sobald Sie eine Chance übernehmen, erscheint sie hier als Karte in Ihrem Bestand.</p>
        </div>
      )}
    </div>
  );
}

export function BeraterPayments() {
  const { balanceCents, addFunds, transactions } = useBroker();

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="broker-eyebrow">Wallet</div>
          <h1>Zahlung</h1>
          <p>Halten Sie Guthaben bereit, um den nächsten passenden Lead sofort zu übernehmen.</p>
        </div>
      </div>

      <div className="broker-payment-box">
        <div className="broker-payment-label">Verfügbares Guthaben</div>
        <div className="broker-balance">{formatEuroExact(balanceCents)}</div>
        <p>Jeder gekaufte Lead erscheint in Ihrem Verlauf.</p>
        <button type="button" onClick={() => addFunds(25000)}>+ 250 € aufladen</button>
      </div>

      <div className="broker-panel broker-history">
        <div className="broker-panel-header">
          <div>
            <h2>Verlauf</h2>
            <p>Aufladungen und Leadkäufe</p>
          </div>
        </div>
        {transactions.length ? (
          <ul className="broker-tx">
            {transactions.map((entry) => (
              <li key={entry.id}>
                <span>
                  <strong>{entry.label}</strong>
                  <small>{new Date(entry.at).toLocaleString('de-DE')}</small>
                </span>
                <b className={entry.cents < 0 ? 'is-debit' : 'is-credit'}>
                  {entry.cents > 0 ? '+' : ''}{formatEuroExact(entry.cents)}
                </b>
              </li>
            ))}
          </ul>
        ) : (
          <div className="broker-empty">
            <strong>Noch keine Buchungen</strong>
            <p>Käufe und Aufladungen erscheinen hier.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function profileForm(user) {
  const business = user?.profile?.businessAddress || {};
  const billing = user?.profile?.billingAddress || {};
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    company: user?.profile?.company || '',
    legalForm: user?.profile?.legalForm || '',
    businessStreet: business.street || '',
    businessZip: business.zip || '',
    businessCity: business.city || '',
    billingSame: user?.profile?.billingSame !== false,
    billingStreet: billing.street || '',
    billingZip: billing.zip || '',
    billingCity: billing.city || '',
    website: user?.profile?.website || '',
    avatarUrl: user?.avatarUrl || '',
    password: '',
    confirmPassword: '',
  };
}

export function BeraterProfile() {
  const { user, updateProfile, isAdmin } = useAuth();
  const { showToast } = useBroker();
  const [form, setForm] = useState(() => profileForm(user));
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarName, setAvatarName] = useState('');

  useEffect(() => {
    setForm(profileForm(user));
    setAvatarName('');
  }, [user]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
    if (!isAdmin) {
      if (!form.company.trim() || !form.legalForm) {
        setError('Firmenname und Rechtsform sind erforderlich.');
        return;
      }
      if (!form.businessStreet.trim() || !form.businessZip.trim() || !form.businessCity.trim()) {
        setError('Bitte geben Sie die vollständige Geschäftsadresse an.');
        return;
      }
      if (!form.billingSame) {
        if (!form.billingStreet.trim() || !form.billingZip.trim() || !form.billingCity.trim()) {
          setError('Bitte geben Sie die vollständige Rechnungsadresse an.');
          return;
        }
      }
    }
    if (form.password && form.password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setSaving(true);
    try {
      const { password, confirmPassword, ...rest } = form;
      await updateProfile({
        ...rest,
        ...(password ? { password } : {}),
      });
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setAvatarName('');
      showToast(password ? 'Profil und Passwort gespeichert' : 'Profil gespeichert');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="broker-page">
      <div className="broker-heading">
        <div>
          <div className="broker-eyebrow">Einstellungen</div>
          <h1>Profil &amp; Stammdaten</h1>
          <p>
            {isAdmin
              ? 'Admin-Konto: Name, Telefon und Passwort. Unternehmensdaten sind optional.'
              : user?.onboardingComplete
                ? 'Ansprechpartner, Unternehmen und Erreichbarkeit für Ihr Maklerkonto.'
                : 'Ergänzen Sie Telefon, Firma und Adresse — danach ist Ihr Konto vollständig.'}
          </p>
        </div>
      </div>

      <form className="broker-panel broker-settings broker-settings--wide" onSubmit={save}>
        <h2>Benutzerkonto und Ansprechpartner</h2>
        {error && <div className="broker-alert">{error}</div>}

        <div className="broker-avatar-edit">
          <div className="broker-avatar-preview" aria-hidden="true">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" />
            ) : (
              <span>
                {(form.firstName[0] || '').toUpperCase()}
                {(form.lastName[0] || '').toUpperCase()}
              </span>
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
            Vorname
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
            Nachname
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
            Geschäftliche E-Mail-Adresse
            <input type="email" value={user?.email || ''} autoComplete="email" disabled />
          </label>
          <label className="is-full">
            Mobilnummer / geschäftliche Telefonnummer
            <PhoneField
              id="profile-phone"
              value={form.phone}
              onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
              disabled={saving}
              required
              className="vantaro-phone-input--light"
            />
          </label>
          <label>
            Neues Passwort
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="Unverändert lassen"
                disabled={saving}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          <label>
            Passwort bestätigen
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              placeholder="Nur bei Änderung"
              disabled={saving}
            />
          </label>
        </div>

        <h2>Unternehmens- und Maklerdaten{isAdmin ? ' (optional)' : ''}</h2>
        {user?.customerNumber ? (
          <p className="broker-customer-number">
            Interne VANTARO-Kundennummer: <strong>{user.customerNumber}</strong>
          </p>
        ) : null}

        <div className="broker-form-grid">
          <label className="is-full">
            Firmenname
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              autoComplete="organization"
              disabled={saving}
              required={!isAdmin}
            />
          </label>
          <label className="is-full">
            Rechtsform
            <select
              name="legalForm"
              value={form.legalForm}
              onChange={handleChange}
              disabled={saving}
              required={!isAdmin}
            >
              <option value="">Bitte wählen</option>
              {LEGAL_FORMS.map((formName) => (
                <option key={formName} value={formName}>
                  {formName}
                </option>
              ))}
            </select>
          </label>
          <label className="is-full">
            Geschäftsadresse
            <input
              name="businessStreet"
              value={form.businessStreet}
              onChange={handleChange}
              placeholder="Straße und Hausnummer"
              disabled={saving}
              required={!isAdmin}
            />
          </label>
          <label>
            PLZ
            <input
              name="businessZip"
              value={form.businessZip}
              onChange={handleChange}
              disabled={saving}
              required={!isAdmin}
            />
          </label>
          <label>
            Ort
            <input
              name="businessCity"
              value={form.businessCity}
              onChange={handleChange}
              disabled={saving}
              required={!isAdmin}
            />
          </label>
          <label className="is-full broker-check">
            <input
              type="checkbox"
              name="billingSame"
              checked={form.billingSame}
              onChange={handleChange}
              disabled={saving}
            />
            Rechnungsadresse entspricht der Geschäftsadresse
          </label>
          {!form.billingSame && (
            <>
              <label className="is-full">
                Rechnungsadresse
                <input
                  name="billingStreet"
                  value={form.billingStreet}
                  onChange={handleChange}
                  placeholder="Straße und Hausnummer"
                  disabled={saving}
                  required={!isAdmin}
                />
              </label>
              <label>
                PLZ
                <input
                  name="billingZip"
                  value={form.billingZip}
                  onChange={handleChange}
                  disabled={saving}
                  required={!isAdmin}
                />
              </label>
              <label>
                Ort
                <input
                  name="billingCity"
                  value={form.billingCity}
                  onChange={handleChange}
                  disabled={saving}
                  required={!isAdmin}
                />
              </label>
            </>
          )}
          <label className="is-full">
            Website
            <input
              name="website"
              type="url"
              value={form.website}
              onChange={handleChange}
              placeholder="https://www.beispiel.de"
              disabled={saving}
            />
          </label>
        </div>

        {(form.businessStreet || form.businessZip || form.businessCity) ? (
          <p className="broker-muted-note">
            Aktuelle Geschäftsadresse:{' '}
            {formatAddress({
              street: form.businessStreet,
              zip: form.businessZip,
              city: form.businessCity,
            })}
          </p>
        ) : null}

        <button type="submit" className="broker-save" disabled={saving}>
          {saving ? 'Wird gespeichert…' : 'Profil speichern'}
        </button>
      </form>
    </div>
  );
}
