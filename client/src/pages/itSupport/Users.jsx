import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  Copy,
  KeyRound,
  ListRestart,
  Lock,
  LockOpen,
  MailCheck,
  RectangleEllipsis,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { api } from './api';
import ActivityTimeline from './ActivityTimeline';
import {
  formatDateTime,
  formatEuro,
  label,
  mapOptions,
  PARTNER_ROLE,
  PAYMENT_EVENT,
  PAYMENT_STATUS,
  REQUEST_STATUS,
  ROLE,
  VERTICAL,
} from './format';
import { L } from './i18n';
import {
  ActionList,
  Banner,
  Button,
  Card,
  Chip,
  CopyId,
  DataTable,
  Drawer,
  EmptyState,
  ErrorBanner,
  KeyValue,
  Loading,
  Page,
  Pagination,
  SearchInput,
  Segmented,
  Select,
  Tabs,
  Toolbar,
  useActionDialog,
  useApi,
  When,
} from './ui';

const PAYMENT_TONE = { paid: 'ok', pending: 'info', failed: 'error', refunded: 'neutral' };

function UserChips({ user }) {
  return (
    <div className="its-cell-chips">
      {user.blocked ? <Chip tone="error">{L('Gesperrt', 'Blocked')}</Chip> : null}
      {!user.verified ? <Chip tone="warn">{L('Unbestätigt', 'Unconfirmed')}</Chip> : null}
      {!user.partnerActive ? <Chip tone="warn">{L('Zugang aus', 'Access off')}</Chip> : null}
      {user.verified && !user.blocked && user.partnerActive ? <Chip tone="ok" icon={false}>{L('Aktiv', 'Active')}</Chip> : null}
    </div>
  );
}

/** Plain-language diagnosis for "I can't log in" tickets. */
function diagnose(user) {
  const hints = [];
  if (user.blocked) hints.push({ tone: 'error', text: L('Das Konto ist gesperrt – Anmeldung ist nicht möglich.', 'The account is blocked – signing in is not possible.') });
  if (!user.verified) {
    if (user.verificationAttempts >= 5) {
      hints.push({
        tone: 'error',
        text: L(
          'Zu viele falsche Bestätigungscodes eingegeben. Neuen Code senden oder E-Mail manuell bestätigen.',
          'Too many wrong confirmation codes entered. Send a new code or confirm the email manually.',
        ),
      });
    } else if (user.verificationExpiresAt && new Date(user.verificationExpiresAt) < new Date()) {
      hints.push({
        tone: 'warn',
        text: L(
          'Der Bestätigungscode ist abgelaufen. Neuen Code senden oder E-Mail manuell bestätigen.',
          'The confirmation code has expired. Send a new code or confirm the email manually.',
        ),
      });
    } else {
      hints.push({
        tone: 'warn',
        text: L(
          'Die E-Mail-Adresse ist noch nicht bestätigt – ohne Bestätigung ist keine Anmeldung möglich.',
          'The email address is not confirmed yet – signing in is not possible without confirmation.',
        ),
      });
    }
  }
  if (!user.partnerActive) {
    hints.push({ tone: 'warn', text: L('Der Unterpartner-Zugang ist deaktiviert (von der Hauptfirma oder IT-Support).', 'The sub-partner access is deactivated (by the main company or IT Support).') });
  }
  if (user.needsVertical) {
    hints.push({ tone: 'info', text: L('Der Nutzer muss beim nächsten Login noch Versicherung oder Energie wählen.', 'The user still has to choose insurance or energy at the next sign-in.') });
  }
  if (user.role === 'berater' && !user.onboardingComplete) {
    hints.push({ tone: 'info', text: L('Die Ersteinrichtung (Stammdaten) ist noch nicht abgeschlossen.', 'The initial setup (company details) is not finished yet.') });
  }
  if (user.providers?.length && !user.providers.includes('email')) {
    hints.push({
      tone: 'info',
      text: L(
        `Meldet sich über ${user.providers.join(', ')} an – kein VANTARO-Passwort vorhanden.`,
        `Signs in with ${user.providers.join(', ')} – no VANTARO password.`,
      ),
    });
  }
  return hints;
}

function UserEditForm({ user, onSaved }) {
  const initial = useMemo(() => ({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    phone: user.phone || '',
    company: user.company || '',
    email: user.email || '',
  }), [user]);
  const [form, setForm] = useState(initial);
  const dialog = useActionDialog();
  useEffect(() => setForm(initial), [initial]);
  const changed = Object.keys(form).filter((key) => form[key] !== initial[key]);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const emailEditable = user.role === 'berater';

  const save = (event) => {
    event.preventDefault();
    if (!changed.length) return;
    const emailChanged = changed.includes('email');
    dialog.open({
      title: L('Nutzerdaten speichern', 'Save user details'),
      effects: [
        L(`Geändert: ${changed.join(', ')}.`, `Changed: ${changed.join(', ')}.`),
        emailChanged
          ? L(
            'Die Anmeldung erfolgt künftig mit der neuen E-Mail-Adresse. Bitte den Nutzer informieren.',
            'From now on the user signs in with the new email address. Please let the user know.',
          )
          : null,
        L('Vorher- und Nachher-Werte werden protokolliert.', 'Before and after values are logged.'),
      ].filter(Boolean),
      reason: emailChanged ? 'required' : 'optional',
      confirmLabel: L('Speichern', 'Save'),
      success: L('Nutzer gespeichert.', 'User saved.'),
      onConfirm: async ({ reason }) => {
        const payload = Object.fromEntries(changed.map((key) => [key, form[key]]));
        await api.patch(`/users/${user.id}`, { ...payload, reason });
        onSaved();
      },
    });
  };

  return (
    <form className="its-form" onSubmit={save}>
      <div className="its-form-grid">
        <label className="its-field"><span>{L('Vorname', 'First name')}</span><input value={form.firstName} onChange={set('firstName')} /></label>
        <label className="its-field"><span>{L('Nachname', 'Last name')}</span><input value={form.lastName} onChange={set('lastName')} /></label>
        <label className="its-field"><span>{L('Telefon', 'Phone')}</span><input type="tel" value={form.phone} onChange={set('phone')} placeholder="+49 …" /></label>
        <label className="its-field"><span>{L('Firma', 'Company')}</span><input value={form.company} onChange={set('company')} /></label>
        <label className="its-field is-wide">
          <span>{L('E-Mail-Adresse (Login)', 'Email address (sign-in)')}</span>
          <input type="email" value={form.email} onChange={set('email')} disabled={!emailEditable} />
          <small>
            {emailEditable
              ? L('Änderung wird sofort wirksam, ohne Bestätigungs-E-Mail.', 'The change takes effect immediately, without a confirmation email.')
              : L('Nur bei Berater-Konten änderbar.', 'Only changeable for advisor accounts.')}
          </small>
        </label>
      </div>
      <div className="its-form-foot">
        <span className="its-muted">
          {changed.length ? L(`${changed.length} ungespeicherte Änderung(en)`, `${changed.length} unsaved change(s)`) : L('Keine Änderungen', 'No changes')}
        </span>
        <Button tone="ghost" onClick={() => setForm(initial)} disabled={!changed.length}>{L('Verwerfen', 'Discard')}</Button>
        <Button type="submit" tone="primary" icon={Save} disabled={!changed.length}>{L('Speichern', 'Save')}</Button>
      </div>
      {dialog.element}
    </form>
  );
}

/**
 * Shows a code IT Support just created. It is displayed only here, once: the server keeps a hash
 * and the activity log never contains it.
 */
function IssuedCodeDialog({ issued, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!issued) return undefined;
    setCopied(false);
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      // Closing re-renders before the panel's own Escape listener runs; stop it so only this window closes.
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [issued, onClose]);

  if (!issued) return null;
  const origin = window.location.origin;
  const copy = () => {
    navigator.clipboard?.writeText(issued.code).then(() => setCopied(true)).catch(() => {});
  };

  return (
    <div className="its-modal-layer" role="presentation">
      <button type="button" className="its-drawer-scrim" aria-label={L('Schließen', 'Close')} onClick={onClose} />
      <div className="its-modal" role="dialog" aria-modal="true" aria-label={L('Bestätigungscode erstellt', 'Confirmation code created')}>
        <header>
          <h2>{L('Bestätigungscode erstellt', 'Confirmation code created')}</h2>
          <Button size="sm" tone="ghost" icon={X} onClick={onClose} aria-label={L('Schließen', 'Close')} />
        </header>
        <div className="its-modal-body">
          <div className="its-code-box">
            <output className="its-code" aria-label={issued.code.split('').join(' ')}>
              {issued.code.slice(0, 3)}&thinsp;{issued.code.slice(3)}
            </output>
            <Button size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? L('Kopiert', 'Copied') : L('Kopieren', 'Copy')}</Button>
          </div>
          <p className="its-code-meta">
            {L(`Für ${issued.email} · gültig bis ${formatDateTime(issued.expiresAt)}`, `For ${issued.email} · valid until ${formatDateTime(issued.expiresAt)}`)}
          </p>
          <div className="its-effects">
            <span>{L('So geht es weiter', 'Next steps')}</span>
            <ol>
              <li>{L(
                'Geben Sie den Code persönlich weiter – telefonisch oder vor Ort. Nicht an die E-Mail-Adresse senden, auf die der Nutzer keinen Zugriff hat.',
                'Pass the code on personally – by phone or in person. Do not send it to the email address the user cannot access.',
              )}</li>
              <li>{L(
                `Der Nutzer meldet sich unter ${origin}/login mit E-Mail und Passwort an. Die Bestätigungsseite öffnet sich, dort gibt er den Code ein.`,
                `The user signs in at ${origin}/login with their email and password. The confirmation page opens, and they enter the code there.`,
              )}</li>
              <li>{L(
                `Hat er die Registrierung nie abgeschlossen, registriert er sich unter ${origin}/register erneut mit derselben E-Mail-Adresse – der Code bleibt gültig, es kommt keine E-Mail.`,
                `If they never finished registering, they register again at ${origin}/register with the same email address – the code stays valid and no email is sent.`,
              )}</li>
              <li>{L('Nach 5 falschen Eingaben ist der Code gesperrt – dann einen neuen erstellen.', 'After 5 wrong entries the code is locked – then create a new one.')}</li>
            </ol>
          </div>
          <Banner tone="warn">{L(
            'Der Code wird nur jetzt angezeigt und nirgends lesbar gespeichert. Geht er verloren, erstellen Sie einen neuen – der alte wird dann ungültig.',
            'The code is shown only now and is not stored in readable form anywhere. If it gets lost, create a new one – the old one then stops working.',
          )}</Banner>
        </div>
        <footer>
          <Button tone="primary" onClick={onClose}>{L('Fertig', 'Done')}</Button>
        </footer>
      </div>
    </div>
  );
}

function UserDrawer({ id, onClose, onChanged }) {
  const { data, error, loading, reload } = useApi(id ? `/users/${id}` : null);
  const [tab, setTab] = useState('overview');
  const [issued, setIssued] = useState(null);
  const closeIssued = useCallback(() => setIssued(null), []);
  const dialog = useActionDialog();
  const navigate = useNavigate();
  useEffect(() => setTab('overview'), [id]);

  const refresh = useCallback(() => {
    reload();
    onChanged();
  }, [reload, onChanged]);

  const user = data?.user;
  const manageable = data?.manageable && !data?.self;
  const lockedReason = data?.self
    ? L('Nicht für das eigene Konto.', 'Not for your own account.')
    : L('Admin- und IT-Support-Konten sind geschützt.', 'Admin and IT Support accounts are protected.');

  const simple = (path, config) => () => dialog.open({
    ...config,
    onConfirm: async ({ reason, values, typed }) => {
      await api.post(`/users/${id}/${path}`, { reason, ...(config.body ? config.body(values, typed) : {}) });
      refresh();
    },
  });

  const actions = user ? [
    {
      id: 'resend',
      icon: Send,
      label: L('Bestätigungscode erneut senden', 'Resend confirmation code'),
      description: L(
        'Neuer 6-stelliger Code per E-Mail (15 Minuten gültig). Alte Codes werden ungültig.',
        'New 6-digit code by email (valid for 15 minutes). Old codes stop working.',
      ),
      hidden: user.verified,
      disabled: !manageable,
      disabledReason: lockedReason,
      onClick: simple('resend-verification', {
        title: L('Bestätigungscode senden', 'Send confirmation code'),
        effects: [
          L(`E-Mail mit neuem Code an ${user.email}.`, `Email with a new code to ${user.email}.`),
          L('Der Zähler für Fehlversuche startet neu.', 'The failed-attempt counter starts over.'),
        ],
        reason: 'optional',
        confirmLabel: L('Code senden', 'Send code'),
        success: L('Bestätigungscode gesendet.', 'Confirmation code sent.'),
      }),
    },
    {
      id: 'code',
      icon: RectangleEllipsis,
      label: L('Bestätigungscode erstellen', 'Create confirmation code'),
      description: L(
        'Wenn die E-Mail nicht ankommt oder der Nutzer keinen Zugriff auf das Postfach hat: 6-stelliger Code, den Sie selbst weitergeben. Es wird keine E-Mail gesendet.',
        'If the email does not arrive or the user cannot access the inbox: a 6-digit code that you pass on yourself. No email is sent.',
      ),
      hidden: user.verified,
      disabled: !manageable,
      disabledReason: lockedReason,
      onClick: () => dialog.open({
        title: L('Bestätigungscode erstellen', 'Create confirmation code'),
        description: L(`Für ${user.fullName || user.email} (${user.email}).`, `For ${user.fullName || user.email} (${user.email}).`),
        effects: [
          L(
            'Ein neuer 6-stelliger Code wird erstellt und Ihnen einmalig angezeigt. Es wird keine E-Mail gesendet.',
            'A new 6-digit code is created and shown to you once. No email is sent.',
          ),
          L(
            'Ein vorheriger Code wird ungültig. „Code erneut senden“ auf der Bestätigungsseite ersetzt diesen Code nicht.',
            'Any earlier code stops working. "Resend code" on the confirmation page does not replace this code.',
          ),
          L('Ihre Notiz wird im Aktivitätsprotokoll gespeichert – der Code selbst nie.', 'Your note is stored in the activity log – the code itself never is.'),
        ],
        fields: [{
          name: 'hours',
          label: L('Gültig für', 'Valid for'),
          type: 'select',
          options: [
            { value: '24', label: L('24 Stunden', '24 hours') },
            { value: '72', label: L('3 Tage', '3 days') },
            { value: '168', label: L('7 Tage', '7 days') },
          ],
        }],
        initialValues: { hours: '24' },
        reason: 'required',
        reasonLabel: L('Notiz – warum wird der Code erstellt?', 'Note – why are you creating this code?'),
        reasonPlaceholder: L(
          'z. B. Ticket-Nr., Bestätigungs-E-Mail kommt nicht an, kein Zugriff auf das Postfach …',
          'e.g. ticket no., confirmation email does not arrive, no access to the inbox …',
        ),
        confirmLabel: L('Code erstellen', 'Create code'),
        onConfirm: async ({ reason, values }) => {
          const result = await api.post(`/users/${id}/verification-code`, { reason, hours: Number(values.hours || 24) });
          setIssued({ code: result.code, expiresAt: result.expiresAt, email: user.email });
          refresh();
        },
      }),
    },
    {
      id: 'verify',
      icon: MailCheck,
      label: L('E-Mail manuell bestätigen', 'Confirm email manually'),
      description: L('Wenn keine E-Mail ankommt: Konto ohne Code freischalten.', 'If no email arrives: activate the account without a code.'),
      hidden: user.verified,
      disabled: !manageable,
      disabledReason: lockedReason,
      onClick: simple('verify-email', {
        title: L('E-Mail manuell bestätigen', 'Confirm email manually'),
        description: L(
          'Nur verwenden, wenn sicher ist, dass die Adresse dem Nutzer gehört.',
          'Only use this if you are sure the address belongs to the user.',
        ),
        effects: [
          L('Das Konto gilt sofort als bestätigt, der Nutzer kann sich anmelden.', 'The account counts as confirmed immediately and the user can sign in.'),
          L('Ein offener Bestätigungscode wird verworfen.', 'Any open confirmation code is discarded.'),
        ],
        reason: 'required',
        confirmLabel: L('Bestätigen', 'Confirm'),
        success: L('E-Mail bestätigt.', 'Email confirmed.'),
      }),
    },
    {
      id: 'password',
      icon: KeyRound,
      label: L('Link zum Zurücksetzen des Passworts senden', 'Send password reset link'),
      description: L(
        'Der Nutzer erhält eine E-Mail und vergibt selbst ein neues Passwort (30 Minuten gültig).',
        'The user gets an email and sets a new password themselves (valid for 30 minutes).',
      ),
      disabled: user.providers?.length > 0 && !user.providers.includes('email'),
      disabledReason: L('Konto meldet sich über Google/Apple an – kein Passwort vorhanden.', 'The account signs in with Google/Apple – there is no password.'),
      onClick: simple('password-reset', {
        title: L('Passwort-Link senden', 'Send password link'),
        effects: [
          L(`E-Mail an ${user.email}.`, `Email to ${user.email}.`),
          L('Das aktuelle Passwort bleibt gültig, bis der Nutzer ein neues setzt.', 'The current password keeps working until the user sets a new one.'),
        ],
        reason: 'optional',
        confirmLabel: L('Link senden', 'Send link'),
        success: L('Passwort-Link gesendet.', 'Password link sent.'),
      }),
    },
    user.blocked ? {
      id: 'unblock',
      icon: LockOpen,
      label: L('Sperre aufheben', 'Unblock account'),
      description: L('Der Nutzer kann sich wieder anmelden.', 'The user can sign in again.'),
      disabled: !manageable,
      disabledReason: lockedReason,
      onClick: simple('unblock', {
        title: L('Sperre aufheben', 'Unblock account'),
        effects: [L('Anmeldung ist sofort wieder möglich.', 'Signing in works again immediately.')],
        reason: 'optional',
        confirmLabel: L('Entsperren', 'Unblock'),
        success: L('Sperre aufgehoben.', 'Account unblocked.'),
      }),
    } : {
      id: 'block',
      icon: Lock,
      tone: 'warn',
      label: L('Konto sperren', 'Block account'),
      description: L(
        'Anmeldung verhindern, z. B. bei Missbrauch oder kompromittiertem Konto. Daten bleiben erhalten.',
        'Prevent sign-in, e.g. after misuse or a compromised account. Data is kept.',
      ),
      disabled: !manageable,
      disabledReason: lockedReason,
      onClick: simple('block', {
        title: L('Konto sperren', 'Block account'),
        tone: 'danger',
        effects: [
          L(
            'Der Nutzer kann sich nicht mehr anmelden; laufende Sitzungen enden spätestens nach einer Stunde.',
            'The user can no longer sign in; open sessions end within an hour at the latest.',
          ),
          L('Leads, Zahlungen und Aufträge bleiben unverändert.', 'Leads, payments and orders stay unchanged.'),
        ],
        reason: 'required',
        confirmLabel: L('Sperren', 'Block'),
        success: L('Konto gesperrt.', 'Account blocked.'),
      }),
    },
    {
      id: 'partner',
      icon: user.partnerActive ? UserX : UserCheck,
      tone: user.partnerActive ? 'warn' : 'default',
      label: user.partnerActive ? L('Partnerzugang deaktivieren', 'Deactivate partner access') : L('Partnerzugang aktivieren', 'Activate partner access'),
      description: L(
        'Zugang eines Unterpartners (Disponent, Außendienst) ein- oder ausschalten.',
        'Turn a sub-partner\'s access (dispatcher, field rep) on or off.',
      ),
      hidden: user.partnerRole === 'main',
      disabled: !manageable,
      disabledReason: lockedReason,
      onClick: simple('partner-access', {
        title: user.partnerActive ? L('Partnerzugang deaktivieren', 'Deactivate partner access') : L('Partnerzugang aktivieren', 'Activate partner access'),
        effects: [user.partnerActive
          ? L('Der Unterpartner kann das Portal nicht mehr nutzen.', 'The sub-partner can no longer use the portal.')
          : L('Der Unterpartner kann sich wieder anmelden.', 'The sub-partner can sign in again.')],
        reason: user.partnerActive ? 'required' : 'optional',
        confirmLabel: user.partnerActive ? L('Deaktivieren', 'Deactivate') : L('Aktivieren', 'Activate'),
        success: L('Partnerzugang geändert.', 'Partner access changed.'),
        body: () => ({ active: !user.partnerActive }),
      }),
    },
    {
      id: 'onboarding',
      icon: ListRestart,
      label: L('Ersteinrichtung zurücksetzen', 'Reset initial setup'),
      description: L('Stammdaten-Abfrage beim nächsten Login erneut anzeigen.', 'Show the company details form again at the next sign-in.'),
      hidden: user.role !== 'berater' || !user.onboardingComplete,
      disabled: !manageable,
      disabledReason: lockedReason,
      onClick: simple('reset-onboarding', {
        title: L('Ersteinrichtung zurücksetzen', 'Reset initial setup'),
        effects: [
          L('Beim nächsten Login muss der Berater seine Stammdaten erneut bestätigen.', 'At the next sign-in the advisor has to confirm their company details again.'),
          L('Kundennummer und Daten bleiben erhalten.', 'Customer number and data are kept.'),
        ],
        reason: 'required',
        confirmLabel: L('Zurücksetzen', 'Reset'),
        success: L('Ersteinrichtung zurückgesetzt.', 'Initial setup reset.'),
      }),
    },
    {
      id: 'delete',
      icon: Trash2,
      tone: 'danger',
      label: L('Konto löschen', 'Delete account'),
      description: L(
        'Nur für Test- oder Fehlkonten ohne Zahlungen, Leads und offene Aufträge.',
        'Only for test or mistaken accounts without payments, leads or open orders.',
      ),
      hidden: user.role !== 'berater',
      disabled: !manageable,
      disabledReason: lockedReason,
      onClick: () => dialog.open({
        title: L('Konto endgültig löschen', 'Delete account permanently'),
        tone: 'danger',
        description: L(
          `${user.fullName || user.email} wird unwiderruflich gelöscht.`,
          `${user.fullName || user.email} will be deleted permanently.`,
        ),
        effects: [
          L('Login, Profil und Einstellungen werden entfernt.', 'Sign-in, profile and settings are removed.'),
          L(
            'Gesperrt, wenn bezahlte Zahlungen, zugewiesene Leads oder offene Aufträge existieren.',
            'Refused if paid payments, assigned leads or open orders exist.',
          ),
          L('Die wichtigsten Kontodaten bleiben im Aktivitätsprotokoll.', 'The key account details stay in the activity log.'),
        ],
        reason: 'required',
        confirmText: user.email,
        confirmLabel: L('Endgültig löschen', 'Delete permanently'),
        success: L('Konto gelöscht.', 'Account deleted.'),
        onConfirm: async ({ reason, typed }) => {
          await api.del(`/users/${id}`, { reason, confirmEmail: typed });
          onChanged();
          onClose();
        },
      }),
    },
  ] : [];

  const hints = user ? diagnose(user) : [];
  const yes = L('ja', 'yes');

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={user ? (user.fullName || user.email) : L('Nutzer', 'User')}
      subtitle={user ? <>{user.email} · <CopyId value={user.id} /></> : null}
      headerExtra={<Button size="sm" tone="ghost" icon={RefreshCw} onClick={reload} aria-label={L('Neu laden', 'Reload')} />}
    >
      {!data && loading ? <Loading /> : null}
      <ErrorBanner error={error} onRetry={reload} />
      {user ? (
        <>
          <div className="its-drawer-chips">
            <Chip tone={user.staff ? 'info' : 'neutral'} icon={false}>{label(ROLE, user.role)}</Chip>
            <UserChips user={user} />
          </div>
          {hints.length ? (
            <div className="its-problem-list">
              {hints.map((hint) => <Banner key={hint.text} tone={hint.tone}>{hint.text}</Banner>)}
            </div>
          ) : (
            <Banner tone="ok">{L('Keine Auffälligkeiten: E-Mail bestätigt, Konto aktiv.', 'Nothing unusual: email confirmed, account active.')}</Banner>
          )}
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: L('Überblick', 'Overview') },
              { value: 'edit', label: L('Bearbeiten', 'Edit') },
              { value: 'actions', label: L('Aktionen', 'Actions') },
              { value: 'business', label: L('Zahlungen & Aufträge', 'Payments & orders'), count: data.payments.length },
              { value: 'history', label: L('Verlauf', 'History'), count: data.activity.length },
            ]}
          />
          {tab === 'overview' ? (
            <KeyValue items={[
              ['Name', user.fullName],
              [L('E-Mail', 'Email'), user.email],
              [L('Telefon', 'Phone'), user.phone],
              [L('Firma', 'Company'), user.company],
              [L('Rolle', 'Role'), label(ROLE, user.role)],
              [L('Bereich', 'Area'), user.staff ? null : label(VERTICAL, user.vertical)],
              [L('Partnerrolle', 'Partner role'), user.staff ? null : label(PARTNER_ROLE, user.partnerRole)],
              data.company ? [L('Hauptfirma', 'Main company'), `${data.company.company || data.company.fullName} (${data.company.email})`] : null,
              [L('Kundennummer', 'Customer number'), user.customerNumber],
              [L('Anmeldung über', 'Signs in with'), (user.providers || []).join(', ') || L('E-Mail & Passwort', 'Email & password')],
              [L('E-Mail bestätigt', 'Email confirmed'), user.verified
                ? `${yes}${user.emailConfirmedAt ? ` (${formatDateTime(user.emailConfirmedAt)})` : ''}`
                : L('nein', 'no')],
              user.verificationPending ? [L('Bestätigungscode', 'Confirmation code'), L(
                `${user.verificationMethod === 'manual' ? 'manuell gesetzt' : 'per E-Mail'} · gültig bis ${formatDateTime(user.verificationExpiresAt)} · ${user.verificationAttempts} Fehlversuch(e)`,
                `${user.verificationMethod === 'manual' ? 'set manually' : 'by email'} · valid until ${formatDateTime(user.verificationExpiresAt)} · ${user.verificationAttempts} failed attempt(s)`,
              )] : null,
              user.passwordResetPending ? [L('Passwort-Link', 'Password link'), L(`gesendet ${formatDateTime(user.passwordResetSentAt)}`, `sent ${formatDateTime(user.passwordResetSentAt)}`)] : null,
              [L('Ersteinrichtung', 'Initial setup'), user.staff ? null : (user.onboardingComplete ? L('abgeschlossen', 'finished') : L('offen', 'open'))],
              [L('Gesperrt', 'Blocked'), user.blocked ? L(`ja (bis ${formatDateTime(user.bannedUntil)})`, `yes (until ${formatDateTime(user.bannedUntil)})`) : L('nein', 'no')],
              [L('Zugewiesene Leads', 'Assigned leads'), String(data.stats.leadCount)],
              [L('Letzter Login', 'Last sign-in'), user.lastSignInAt ? formatDateTime(user.lastSignInAt) : L('noch nie', 'never')],
              [L('Registriert', 'Registered'), formatDateTime(user.createdAt)],
            ]}
            />
          ) : null}
          {tab === 'edit' ? (
            manageable || data.self
              ? <UserEditForm user={user} onSaved={refresh} />
              : <Banner tone="info">{L('Admin- und IT-Support-Konten können in der Konsole nicht bearbeitet werden.', 'Admin and IT Support accounts cannot be edited in the console.')}</Banner>
          ) : null}
          {tab === 'actions' ? <ActionList actions={actions} /> : null}
          {tab === 'business' ? (
            <div className="its-stack">
              <Card title={L('Zahlungen', 'Payments')} flush>
                {data.payments.length ? (
                  <ul className="its-plain-list is-padded">
                    {data.payments.map((payment) => (
                      <li key={payment.id}>
                        <button type="button" className="its-link" onClick={() => navigate(`/it-support/payments?id=${payment.id}`)}>
                          {payment.invoiceNumber}
                        </button>
                        <Chip tone={PAYMENT_TONE[payment.status]}>{label(PAYMENT_STATUS, payment.status)}</Chip>
                        <span>{formatEuro(payment.grossCents)} · {payment.packageLabel}</span>
                        <small><When value={payment.createdAt} /></small>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title={L('Keine Zahlungen', 'No payments')} />}
              </Card>
              <Card title={L('Aufträge', 'Orders')} flush>
                {data.requests.length ? (
                  <ul className="its-plain-list is-padded">
                    {data.requests.map((request) => (
                      <li key={request.id}>
                        <code>{request.code || request.id.slice(0, 8)}</code>
                        <Chip tone={request.status === 'active' ? 'ok' : 'neutral'} icon={false}>{label(REQUEST_STATUS, request.status)}</Chip>
                        <span>{request.requestedCount} × {request.leadType}</span>
                        <small><When value={request.createdAt} /></small>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title={L('Keine Aufträge', 'No orders')} />}
              </Card>
              {data.securityEvents.length ? (
                <Card title={L('Zahlungs-Sicherheitsereignisse', 'Payment security events')} flush>
                  <ul className="its-plain-list is-padded">
                    {data.securityEvents.map((event) => (
                      <li key={event.id}>
                        <Chip tone={event.event === 'suspicious_activity' ? 'error' : 'neutral'} icon={false}>{label(PAYMENT_EVENT, event.event)}</Chip>
                        <span>{event.metadata?.reason || event.metadata?.outcome || ''}</span>
                        <small><When value={event.created_at} /></small>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>
          ) : null}
          {tab === 'history' ? (
            <ActivityTimeline entries={data.activity} empty={L('IT-Support hat an diesem Konto noch nichts geändert.', 'IT Support has not changed anything on this account yet.')} />
          ) : null}
          {dialog.element}
          <IssuedCodeDialog issued={issued} onClose={closeIssued} />
        </>
      ) : null}
    </Drawer>
  );
}

export default function UsersPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get('q') || '',
    status: params.get('status') || '',
    role: params.get('role') || '',
    vertical: params.get('vertical') || '',
    page: Number(params.get('page')) || 1,
  };
  const openId = params.get('id');
  const { data, error, loading, reload } = useApi('/users', { ...filters, limit: 25 });
  const counts = data?.counts || {};

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in patch) && !('id' in patch)) next.delete('page');
    setParams(next, { replace: !('id' in patch) });
  };

  const columns = [
    {
      key: 'name',
      label: L('Nutzer', 'User'),
      render: (user) => (
        <div className="its-cell-main">
          <strong>{user.fullName || '—'}</strong>
          <small>{user.email}</small>
        </div>
      ),
    },
    { key: 'role', label: L('Rolle', 'Role'), render: (user) => <Chip tone={user.staff ? 'info' : 'neutral'} icon={false}>{label(ROLE, user.role)}</Chip> },
    { key: 'status', label: 'Status', render: (user) => <UserChips user={user} /> },
    { key: 'vertical', label: L('Bereich', 'Area'), render: (user) => (user.staff ? '—' : label(VERTICAL, user.vertical)) },
    { key: 'customer', label: L('Kundennr.', 'Customer no.'), render: (user) => user.customerNumber || '—' },
    {
      key: 'login',
      label: L('Letzter Login', 'Last sign-in'),
      render: (user) => (user.lastSignInAt ? <When value={user.lastSignInAt} /> : <span className="its-muted">{L('nie', 'never')}</span>),
    },
  ];

  return (
    <Page
      title={L('Nutzer', 'Users')}
      description={L(
        'Konten finden, Daten korrigieren und Anmeldeprobleme lösen: Bestätigung, Passwort, Sperre, Partnerzugang.',
        'Find accounts, correct details and solve sign-in problems: confirmation, password, blocking, partner access.',
      )}
      actions={<Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button>}
    >
      <Toolbar>
        <Segmented
          value={filters.status}
          onChange={(status) => update({ status })}
          options={[
            { value: '', label: L('Alle', 'All'), count: counts.total },
            { value: 'unverified', label: L('Unbestätigt', 'Unconfirmed'), count: counts.unverified, alert: true },
            { value: 'blocked', label: L('Gesperrt', 'Blocked'), count: counts.blocked, alert: true },
            { value: 'partner_inactive', label: L('Zugang aus', 'Access off'), count: counts.partnerInactive },
            { value: 'onboarding', label: L('Einrichtung offen', 'Setup open'), count: counts.onboardingOpen },
          ]}
        />
      </Toolbar>
      <Toolbar>
        <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder={L('Name, E-Mail, Firma, Kundennr., ID …', 'Name, email, company, customer no., ID …')} />
        <Select
          label={L('Rolle', 'Role')}
          value={filters.role}
          onChange={(role) => update({ role })}
          options={[
            { value: '', label: L('Alle', 'All') },
            { value: 'berater', label: L('Berater', 'Advisors') },
            { value: 'staff', label: L('Admin & IT-Support', 'Admin & IT Support') },
          ]}
        />
        <Select
          label={L('Bereich', 'Area')}
          value={filters.vertical}
          onChange={(vertical) => update({ vertical })}
          options={mapOptions(VERTICAL, L('Alle', 'All'))}
        />
      </Toolbar>
      <ErrorBanner error={error} onRetry={reload} />
      <Card flush>
        <DataTable
          columns={columns}
          rows={data?.users || []}
          loading={loading}
          onRowClick={(user) => update({ id: user.id })}
          activeKey={openId}
          empty={<EmptyState title={L('Keine Nutzer gefunden', 'No users found')} />}
        />
        <Pagination page={filters.page} limit={data?.limit || 25} total={data?.total || 0} onPage={(page) => update({ page })} />
      </Card>
      <UserDrawer id={openId} onClose={() => update({ id: '' })} onChanged={reload} />
    </Page>
  );
}
