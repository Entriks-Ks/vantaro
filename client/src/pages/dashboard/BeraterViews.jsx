import { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBroker } from '../../hooks/useBroker';
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

export function BeraterProfile() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useBroker();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (event) => {
    event.preventDefault();
    setError('');

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Bitte geben Sie Ihren Namen an.');
      return;
    }
    if (password && password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        ...(password ? { password } : {}),
      });
      setPassword('');
      setConfirmPassword('');
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
          <h1>Profil</h1>
          <p>Name, E-Mail und Passwort — mehr braucht Ihr Konto nicht.</p>
        </div>
      </div>

      <form className="broker-panel broker-settings" onSubmit={save}>
        <h2>Kontodaten</h2>
        {error && <div className="broker-alert">{error}</div>}
        <div className="broker-form-grid">
          <label>
            Name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              disabled={saving}
              required
            />
          </label>
          <label>
            E-Mail-Adresse
            <input type="email" value={user?.email || ''} autoComplete="email" disabled />
          </label>
          <label>
            Neues Passwort
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Nur bei Änderung"
              disabled={saving}
            />
          </label>
        </div>
        <button type="submit" className="broker-save" disabled={saving}>
          {saving ? 'Wird gespeichert…' : 'Profil speichern'}
        </button>
      </form>
    </div>
  );
}