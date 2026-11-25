import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Eye, EyeOff, KeyRound, Mail, Moon, Save, ShieldCheck, Sun, Trash2, UserRound, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { formatPhoneDisplay, isValidMobile } from '../../components/PhoneField';
import { fileToAvatarDataUrl, passwordRules, validatePassword } from '../../lib/profile';
import { readThemePreference, resolveTheme, subscribeTheme, writeThemePreference } from '../../lib/theme';
import { formatDateTime, label, ROLE } from './format';
import { getLang, L } from './i18n';
import { Banner, Button, Card, Chip, CopyId, KeyValue, Segmented, useApi, useToast } from './ui';

const PROVIDER_NAMES = { google: 'Google', apple: 'Apple', email: 'E-Mail' };
const providerList = (providers) => (providers || []).map((id) => PROVIDER_NAMES[id] || id).join(', ');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** The account API answers in German; the console shows these in its own language. */
const SERVER_MESSAGES = {
  'Aktuelles Passwort ist nicht korrekt.': 'The current password is not correct.',
  'Aktuelles und neues Passwort sind erforderlich.': 'Current and new password are required.',
  'Das neue Passwort muss sich vom aktuellen unterscheiden.': 'The new password must be different from the current one.',
  'Passwort konnte nicht geändert werden.': 'The password could not be changed.',
  'Profil konnte nicht gespeichert werden.': 'The profile could not be saved.',
  'Profilbild konnte nicht gelesen werden.': 'The profile photo could not be read.',
  'Profilbild ist ungültig.': 'The profile photo is not a valid image.',
  'Das Profilbild ist zu groß. Bitte wählen Sie ein kleineres Bild.': 'The profile photo is too large. Please choose a smaller image.',
};
const message = (error) => (getLang() === 'en' && SERVER_MESSAGES[error?.message]) || error?.message || String(error);

/** Initials or the profile photo, in one round frame. Used here and in the sidebar. */
export function Avatar({ user, size = 'md' }) {
  const text = (user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '?')
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  return (
    <span className={`its-avatar is-${size}${user?.avatarUrl ? ' has-photo' : ''}`} aria-hidden="true">
      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : text}
    </span>
  );
}

function PhotoCard({ user, updateProfile }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const save = async (avatarUrl) => {
    setBusy(true);
    setError('');
    try {
      await updateProfile({ avatarUrl });
      toast(avatarUrl ? L('Profilbild gespeichert', 'Profile photo saved') : L('Profilbild entfernt', 'Profile photo removed'));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const takeFile = async (file) => {
    if (!file) return;
    setError('');
    if (!file.type?.startsWith('image/')) {
      setError(L('Bitte eine Bilddatei wählen (JPG, PNG, WebP …).', 'Please choose an image file (JPG, PNG, WebP …).'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(L('Das Bild ist größer als 8 MB.', 'The image is larger than 8 MB.'));
      return;
    }
    try {
      // Scaled down to 192 px in the browser, like the admin and Berater profiles.
      await save(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(message(err));
    }
  };

  return (
    <Card title={L('Profilbild', 'Profile photo')} description={L('Wird in der Seitenleiste der Konsole angezeigt.', 'Shown in the console sidebar.')}>
      <div
        className={`its-photo${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          takeFile(event.dataTransfer.files?.[0]);
        }}
      >
        <button
          type="button"
          className="its-photo-frame"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={L('Profilbild ändern', 'Change profile photo')}
        >
          <Avatar user={user} size="xl" />
          <span className="its-photo-overlay"><Camera size={20} /></span>
        </button>
        <div className="its-photo-text">
          <strong>{user?.avatarUrl ? L('Ihr Profilbild', 'Your profile photo') : L('Noch kein Profilbild', 'No profile photo yet')}</strong>
          <p>{L('Bild hierher ziehen oder auswählen. JPG, PNG oder WebP, bis 8 MB. Es wird automatisch verkleinert.', 'Drag an image here or choose one. JPG, PNG or WebP, up to 8 MB. It is resized automatically.')}</p>
          <div className="its-row-actions">
            <Button tone="primary" size="sm" icon={Camera} loading={busy} onClick={() => inputRef.current?.click()}>
              {user?.avatarUrl ? L('Bild ändern', 'Change photo') : L('Bild hochladen', 'Upload photo')}
            </Button>
            {user?.avatarUrl ? (
              <Button size="sm" tone="ghost" icon={Trash2} disabled={busy} onClick={() => save('')}>{L('Entfernen', 'Remove')}</Button>
            ) : null}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            takeFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Card>
  );
}

function DetailsCard({ user, updateProfile }) {
  const toast = useToast();
  const initial = () => ({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '' });
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) setForm(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, user?.firstName, user?.lastName, user?.phone]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setError('');
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const phone = form.phone.trim().replace(/[\s()/-]/g, '');
    if (firstName.length < 2) return setError(L('Bitte den Vornamen angeben (mindestens 2 Zeichen).', 'Please enter your first name (at least 2 characters).'));
    if (lastName.length < 2) return setError(L('Bitte den Nachnamen angeben (mindestens 2 Zeichen).', 'Please enter your last name (at least 2 characters).'));
    if (phone && !isValidMobile(phone)) return setError(L('Die Telefonnummer ist ungültig. Bitte mit Ländervorwahl, z. B. +49 151 23456789.', 'The phone number is not valid. Please include the country code, e.g. +49 151 23456789.'));
    setBusy(true);
    try {
      await updateProfile({ firstName, lastName, phone });
      setEditing(false);
      toast(L('Profil gespeichert', 'Profile saved'));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={L('Persönliche Daten', 'Personal details')}
      actions={!editing ? <Button size="sm" onClick={() => setEditing(true)}>{L('Bearbeiten', 'Edit')}</Button> : null}
    >
      {editing ? (
        <form className="its-stack" onSubmit={save}>
          <div className="its-form-grid">
            <label className="its-field"><span>{L('Vorname', 'First name')}</span><input value={form.firstName} onChange={set('firstName')} autoComplete="given-name" autoFocus /></label>
            <label className="its-field"><span>{L('Nachname', 'Last name')}</span><input value={form.lastName} onChange={set('lastName')} autoComplete="family-name" /></label>
            <label className="its-field is-wide">
              <span>{L('Telefon (optional)', 'Phone (optional)')}</span>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+49 151 23456789" autoComplete="tel" />
              <small>{L('Mit Ländervorwahl.', 'With the country code.')}</small>
            </label>
          </div>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <div className="its-row-actions">
            <Button type="submit" tone="primary" icon={Save} loading={busy}>{L('Speichern', 'Save')}</Button>
            <Button tone="ghost" icon={X} disabled={busy} onClick={() => { setEditing(false); setError(''); }}>{L('Abbrechen', 'Cancel')}</Button>
          </div>
        </form>
      ) : (
        <KeyValue items={[
          [L('Vorname', 'First name'), user?.firstName],
          [L('Nachname', 'Last name'), user?.lastName],
          [L('Telefon', 'Phone'), user?.phone ? formatPhoneDisplay(user.phone) : null],
        ]}
        />
      )}
    </Card>
  );
}

function PasswordCard({ providers }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const socialOnly = providers && providers.length > 0 && !providers.includes('email');
  if (socialOnly) {
    return (
      <Card title={L('Passwort', 'Password')}>
        <Banner tone="info">
          {L(
            `Dieses Konto meldet sich über ${providerList(providers)} an und hat kein eigenes Passwort. Das Passwort wird dort verwaltet.`,
            `This account signs in with ${providerList(providers)} and has no password of its own. The password is managed there.`,
          )}
        </Banner>
      </Card>
    );
  }

  const rules = passwordRules(form.next);
  const englishRule = {
    length: 'At least 8 characters', lower: 'Lowercase letter', upper: 'Uppercase letter', digit: 'Number', special: 'Special character (!@$%#…)',
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.current) return setError(L('Bitte das aktuelle Passwort eingeben.', 'Please enter your current password.'));
    const problem = validatePassword(form.next);
    if (problem) return setError(L(problem, 'The new password does not meet all the rules below.'));
    if (form.next !== form.repeat) return setError(L('Die neuen Passwörter stimmen nicht überein.', 'The new passwords do not match.'));
    if (form.next === form.current) return setError(L('Das neue Passwort muss sich vom aktuellen unterscheiden.', 'The new password must be different from the current one.'));
    setBusy(true);
    try {
      await changePassword({ currentPassword: form.current, password: form.next });
      setForm({ current: '', next: '', repeat: '' });
      toast(L('Passwort geändert', 'Password changed'));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const type = show ? 'text' : 'password';
  return (
    <Card
      title={L('Passwort ändern', 'Change password')}
      actions={(
        <Button size="sm" tone="ghost" icon={show ? EyeOff : Eye} onClick={() => setShow((value) => !value)}>
          {show ? L('Verbergen', 'Hide') : L('Anzeigen', 'Show')}
        </Button>
      )}
    >
      <form className="its-stack" onSubmit={save}>
        <div className="its-form-grid">
          <label className="its-field is-wide"><span>{L('Aktuelles Passwort', 'Current password')}</span><input type={type} value={form.current} onChange={set('current')} autoComplete="current-password" /></label>
          <label className="its-field"><span>{L('Neues Passwort', 'New password')}</span><input type={type} value={form.next} onChange={set('next')} autoComplete="new-password" /></label>
          <label className="its-field"><span>{L('Neues Passwort wiederholen', 'Repeat new password')}</span><input type={type} value={form.repeat} onChange={set('repeat')} autoComplete="new-password" /></label>
        </div>
        <ul className="its-rules">
          {rules.map((rule) => (
            <li key={rule.id} className={rule.ok ? 'is-ok' : undefined}>
              <Check size={13} aria-hidden="true" /> {getLang() === 'en' ? englishRule[rule.id] : rule.label}
            </li>
          ))}
          <li className={form.repeat && form.repeat === form.next ? 'is-ok' : undefined}>
            <Check size={13} aria-hidden="true" /> {L('Beide gleich', 'Both match')}
          </li>
        </ul>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <div className="its-row-actions">
          <Button type="submit" tone="primary" icon={KeyRound} loading={busy}>{L('Passwort ändern', 'Change password')}</Button>
        </div>
      </form>
    </Card>
  );
}

function PreferencesCard({ lang, onLang }) {
  const { updateProfile } = useAuth();
  const [theme, setTheme] = useState(() => resolveTheme(readThemePreference()));
  useEffect(() => subscribeTheme((applied) => setTheme(applied?.resolved || resolveTheme(readThemePreference()))), []);
  return (
    <Card title={L('Darstellung', 'Appearance')}>
      <div className="its-pref">
        <div>
          <strong>{L('Sprache der Konsole', 'Console language')}</strong>
          <small>{L('Gilt nur für die IT-Support-Konsole.', 'Applies to the IT Support console only.')}</small>
        </div>
        <Segmented value={lang} onChange={onLang} options={[{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]} />
      </div>
      <div className="its-pref">
        <div>
          <strong>{L('Design', 'Theme')}</strong>
          <small>{L('Wird in Ihrem Konto gespeichert.', 'Saved in your account.')}</small>
        </div>
        <Segmented
          value={theme}
          onChange={(next) => {
            setTheme(writeThemePreference(next).resolved);
            updateProfile({ settings: { appearance: next } }).catch(() => {});
          }}
          options={[
            { value: 'light', label: <span className="its-seg-icon"><Sun size={13} /> {L('Hell', 'Light')}</span> },
            { value: 'dark', label: <span className="its-seg-icon"><Moon size={13} /> {L('Dunkel', 'Dark')}</span> },
          ]}
        />
      </div>
    </Card>
  );
}

export default function ProfilePage({ lang, onLang }) {
  const { user, updateProfile, isAdmin } = useAuth();
  // The console's own user endpoint says how this account signs in (password or Google/Apple).
  const self = useApi(user?.id ? `/users/${user.id}` : null);
  const account = self.data?.user;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.fullName || user?.email;

  return (
    <div className="its-page">
      <section className="its-profile-hero">
        <Avatar user={user} size="lg" />
        <div className="its-profile-hero-text">
          <span className="its-info-kind">{L('Mein Profil', 'My profile')}</span>
          <h1>{name}</h1>
          <p><Mail size={13} aria-hidden="true" /> {user?.email}</p>
          <div className="its-db-profile-chips">
            <Chip tone="info" icon={false}><ShieldCheck size={12} /> {isAdmin ? 'Admin' : label(ROLE, user?.role)}</Chip>
            {account?.lastSignInAt ? <Chip icon={false}>{L('Letzter Login', 'Last sign-in')}: {formatDateTime(account.lastSignInAt)}</Chip> : null}
          </div>
        </div>
      </section>

      <div className="its-profile-grid">
        <div className="its-stack">
          <PhotoCard user={user} updateProfile={updateProfile} />
          <DetailsCard user={user} updateProfile={updateProfile} />
          <PreferencesCard lang={lang} onLang={onLang} />
        </div>
        <div className="its-stack">
          <PasswordCard providers={account?.providers} />
          <Card title={L('Konto', 'Account')} description={L('Diese Angaben kann nur ein Admin ändern.', 'Only an admin can change these.')}>
            <KeyValue items={[
              [L('E-Mail', 'Email'), user?.email],
              [L('Rolle', 'Role'), isAdmin ? 'Admin' : label(ROLE, user?.role)],
              [L('Anmeldung über', 'Signs in with'), account ? (providerList(account.providers) || L('E-Mail & Passwort', 'Email & password')) : '…'],
              [L('Konto-ID', 'Account ID'), <CopyId key="id" value={user?.id} />],
              [L('Registriert', 'Registered'), account?.createdAt ? formatDateTime(account.createdAt) : null],
            ]}
            />
            <p className="its-muted its-profile-note"><UserRound size={13} aria-hidden="true" /> {L(
              'Der IT-Support-Zugang wird über IT_SUPPORT_EMAILS auf dem Server vergeben.',
              'IT Support access is granted through IT_SUPPORT_EMAILS on the server.',
            )}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
