import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArchiveRestore,
  Eraser,
  ListRestart,
  RefreshCw,
  Save,
  Trash2,
  Undo2,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { api } from './api';
import ActivityTimeline from './ActivityTimeline';
import {
  CLOSE_OUTCOME,
  COMPLAINT_STATUS,
  CONTACT_STATUS,
  formatDate,
  formatDateTime,
  fromLocalInput,
  label,
  LEAD_SOURCE,
  LEAD_STATUS,
  mapOptions,
  REQUEST_STATUS,
  SCOPE,
  toLocalInput,
  VERTICAL,
} from './format';
import { L, pick } from './i18n';
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
  Select,
  Tabs,
  Toolbar,
  useActionDialog,
  useApi,
  useToast,
  When,
} from './ui';

const LEAD_PROBLEMS = [
  { value: 'assigned_status_without_berater', label: ['Status „Zugewiesen“ ohne Berater', 'Status "Assigned" without advisor'], fixable: true },
  { value: 'berater_without_assigned_status', label: ['Berater gesetzt, Status falsch', 'Advisor set, wrong status'], fixable: true },
  { value: 'request_without_berater', label: ['Auftrag ohne Berater', 'Order without advisor'], fixable: true },
  { value: 'termin_without_date', label: ['Termin ohne Datum', 'Appointment without date'], fixable: true },
  { value: 'wiedervorlage_without_date', label: ['Wiedervorlage ohne Datum', 'Follow-up without date'], fixable: true },
  { value: 'closed_without_outcome', label: ['Abgeschlossen ohne Ergebnis', 'Closed without outcome'], fixable: false },
  { value: 'appointment_reminder_missed', label: ['Termin-Erinnerung fehlt', 'Appointment reminder missing'], fixable: false },
  { value: 'follow_up_reminder_missed', label: ['Wiedervorlage-Erinnerung fehlt', 'Follow-up reminder missing'], fixable: false },
];

const CONFIRM_DELETE = () => L('LÖSCHEN', 'DELETE');

function statusTone(lead) {
  if (lead.refundedAt) return 'error';
  if (lead.status === 'zugewiesen') return 'ok';
  if (lead.status === 'erledigt') return 'neutral';
  return 'info';
}

function LeadStatus({ lead }) {
  if (lead.refundedAt) return <Chip tone="error">{L('Verworfen', 'Rejected')}</Chip>;
  return <Chip tone={statusTone(lead)}>{label(LEAD_STATUS, lead.status)}</Chip>;
}

/* ---------------- edit form ---------------- */

const FIELDS = [
  ['firstName', ['Vorname', 'First name']],
  ['lastName', ['Nachname', 'Last name']],
  ['email', ['E-Mail', 'Email'], 'email'],
  ['phone', ['Telefon', 'Phone'], 'tel'],
  ['street', ['Straße', 'Street']],
  ['houseNumber', ['Hausnummer', 'House number']],
  ['zip', ['PLZ', 'Postcode']],
  ['city', ['Ort', 'City']],
  ['dateOfBirth', ['Geburtsdatum', 'Date of birth'], 'date'],
];

function leadToForm(lead) {
  return {
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    email: lead.email || '',
    phone: lead.phone || '',
    street: lead.street || '',
    houseNumber: lead.houseNumber || '',
    zip: lead.zip || '',
    city: lead.city || '',
    dateOfBirth: lead.dateOfBirth ? String(lead.dateOfBirth).slice(0, 10) : '',
    notes: lead.notes || '',
    status: lead.status || 'neu',
    contactStatus: lead.contactStatus || '',
    closeOutcome: lead.closeOutcome || '',
    appointmentAt: toLocalInput(lead.appointmentAt),
    followUpAt: toLocalInput(lead.followUpAt),
    scope: lead.scope || 'deutschlandweit',
  };
}

function LeadEditForm({ lead, deliveryLocked, onSaved }) {
  const initial = useMemo(() => leadToForm(lead), [lead]);
  const [form, setForm] = useState(initial);
  const dialog = useActionDialog();
  useEffect(() => setForm(initial), [initial]);

  const changed = Object.keys(form).filter((key) => form[key] !== initial[key]);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const buildPayload = () => {
    const payload = {};
    for (const key of changed) {
      if (key === 'appointmentAt' || key === 'followUpAt') payload[key] = fromLocalInput(form[key]);
      else payload[key] = form[key] === '' ? null : form[key];
    }
    if (changed.includes('contactStatus') || changed.includes('closeOutcome')) {
      payload.contactStatus = form.contactStatus || null;
      payload.closeOutcome = form.contactStatus === 'abgeschlossen' ? (form.closeOutcome || null) : null;
    }
    if (payload.contactStatus === 'termin' && !('appointmentAt' in payload)) payload.appointmentAt = fromLocalInput(form.appointmentAt);
    if (payload.contactStatus === 'wiedervorlage' && !('followUpAt' in payload)) payload.followUpAt = fromLocalInput(form.followUpAt);
    return payload;
  };

  const save = (event) => {
    event.preventDefault();
    if (!changed.length) return;
    dialog.open({
      title: L('Änderungen speichern', 'Save changes'),
      description: L(`${changed.length} Feld(er) werden geändert.`, `${changed.length} field(s) will be changed.`),
      effects: [
        deliveryLocked
          ? L('Der Lead ist bereits zugestellt: der Berater sieht die Änderung sofort.', 'The lead is already delivered: the advisor sees the change immediately.')
          : L('Der Lead wird direkt in der Datenbank aktualisiert.', 'The lead is updated directly in the database.'),
        L('Vorher- und Nachher-Werte werden im Aktivitätsprotokoll gespeichert.', 'Before and after values are stored in the activity log.'),
      ],
      reason: 'optional',
      confirmLabel: L('Speichern', 'Save'),
      success: L('Lead gespeichert.', 'Lead saved.'),
      onConfirm: async ({ reason }) => {
        await api.patch(`/leads/${lead.id}`, { ...buildPayload(), reason });
        onSaved();
      },
    });
  };

  return (
    <form className="its-form" onSubmit={save}>
      {deliveryLocked ? (
        <Banner tone="warn">
          {L(
            'Dieser Lead ist bereits an einen Berater zugestellt. Im normalen Portal ist er gesperrt – hier können Sie technische Fehler trotzdem korrigieren.',
            'This lead has already been delivered to an advisor. It is locked in the normal portal – here you can still correct technical errors.',
          )}
        </Banner>
      ) : null}
      <fieldset>
        <legend>{L('Kontaktdaten', 'Contact details')}</legend>
        <div className="its-form-grid">
          {FIELDS.map(([key, text, type]) => (
            <label key={key} className="its-field">
              <span>{pick(text)}</span>
              <input type={type || 'text'} value={form[key]} onChange={set(key)} />
            </label>
          ))}
          <label className="its-field">
            <span>{L('Paket', 'Package')}</span>
            <select value={form.scope} onChange={set('scope')}>
              {Object.keys(SCOPE).map((value) => <option key={value} value={value}>{label(SCOPE, value)}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Status</legend>
        <div className="its-form-grid">
          <label className="its-field">
            <span>{L('Lead-Status', 'Lead status')}</span>
            <select value={form.status} onChange={set('status')}>
              {Object.keys(LEAD_STATUS).map((value) => <option key={value} value={value}>{label(LEAD_STATUS, value)}</option>)}
            </select>
          </label>
          <label className="its-field">
            <span>{L('Gesprächsstatus', 'Conversation status')}</span>
            <select value={form.contactStatus} onChange={set('contactStatus')}>
              <option value="">{L('— kein —', '— none —')}</option>
              {Object.keys(CONTACT_STATUS).map((value) => <option key={value} value={value}>{label(CONTACT_STATUS, value)}</option>)}
            </select>
          </label>
          {form.contactStatus === 'abgeschlossen' ? (
            <label className="its-field">
              <span>{L('Ergebnis', 'Outcome')}</span>
              <select value={form.closeOutcome} onChange={set('closeOutcome')}>
                <option value="">{L('— bitte wählen —', '— please choose —')}</option>
                {Object.keys(CLOSE_OUTCOME).map((value) => <option key={value} value={value}>{label(CLOSE_OUTCOME, value)}</option>)}
              </select>
            </label>
          ) : null}
          {form.contactStatus === 'termin' ? (
            <label className="its-field">
              <span>{L('Termin', 'Appointment')}</span>
              <input type="datetime-local" value={form.appointmentAt} onChange={set('appointmentAt')} />
            </label>
          ) : null}
          {form.contactStatus === 'wiedervorlage' ? (
            <label className="its-field">
              <span>{L('Wiedervorlage', 'Follow-up')}</span>
              <input type="datetime-local" value={form.followUpAt} onChange={set('followUpAt')} />
            </label>
          ) : null}
        </div>
      </fieldset>
      <label className="its-field">
        <span>{L('Notizen (für Admin & Berater sichtbar)', 'Notes (visible to admin & advisor)')}</span>
        <textarea rows={4} value={form.notes} onChange={set('notes')} />
      </label>
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

/* ---------------- drawer ---------------- */

function LeadDrawer({ id, onClose, onChanged }) {
  const { data, error, loading, reload } = useApi(id ? `/leads/${id}` : null);
  const [tab, setTab] = useState('overview');
  const dialog = useActionDialog();
  const toast = useToast();

  useEffect(() => setTab('overview'), [id]);

  const refresh = useCallback(() => {
    reload();
    onChanged();
  }, [reload, onChanged]);

  const lead = data?.lead;
  const problems = data?.problems || [];
  const openComplaint = (data?.complaints || []).some((entry) => ['pending', 'info_needed'].includes(entry.status));
  const complaintReason = L('Offene Reklamation – erst entscheidet ein Admin.', 'Open complaint – an admin has to decide it first.');

  const fixProblem = (problem) => dialog.open({
    title: problem.fixLabel,
    description: problem.label,
    effects: [problem.help, L('Die Korrektur wird im Aktivitätsprotokoll gespeichert.', 'The fix is stored in the activity log.')],
    reason: 'optional',
    confirmLabel: L('Korrigieren', 'Fix'),
    success: L('Korrigiert.', 'Fixed.'),
    onConfirm: async ({ reason }) => {
      await api.post(`/leads/${id}/fix`, { checkId: problem.id, reason });
      refresh();
    },
  });

  const openAssign = async () => {
    try {
      const { options: choices } = await api.get(`/leads/${id}/assign-options`);
      if (!choices.length) {
        toast(L(
          'Kein Berater hat einen aktiven Auftrag mit offenem Kontingent in diesem Bereich.',
          'No advisor has an active order with remaining quota in this area.',
        ), 'error');
        return;
      }
      dialog.open({
        title: L('Lead zuweisen', 'Assign lead'),
        description: L(
          `${lead.fullName} einem Berater mit aktivem Auftrag zuweisen.`,
          `Assign ${lead.fullName} to an advisor with an active order.`,
        ),
        effects: [
          L('Der Lead erscheint sofort in „Meine Leads“ des Beraters.', 'The lead appears immediately in the advisor\'s "My leads".'),
          L('Er zählt auf das Kontingent des gewählten Auftrags.', 'It counts towards the quota of the selected order.'),
          L('Danach gilt der Lead als zugestellt.', 'After that the lead counts as delivered.'),
        ],
        fields: [{
          name: 'requestId',
          label: L('Berater & Auftrag', 'Advisor & order'),
          type: 'select',
          required: true,
          options: [{ value: '', label: L('— bitte wählen —', '— please choose —') }, ...choices.map((choice) => ({
            value: choice.requestId,
            label: L(
              `${choice.beraterName} · Auftrag ${choice.code || choice.requestId.slice(0, 8)} · ${choice.remaining} offen`,
              `${choice.beraterName} · order ${choice.code || choice.requestId.slice(0, 8)} · ${choice.remaining} open`,
            ),
          }))],
        }],
        reason: 'optional',
        confirmLabel: L('Zuweisen', 'Assign'),
        success: L('Lead zugewiesen.', 'Lead assigned.'),
        onConfirm: async ({ reason, values }) => {
          const choice = choices.find((entry) => entry.requestId === values.requestId);
          await api.post(`/leads/${id}/assign`, { beraterId: choice.beraterId, requestId: choice.requestId, reason });
          refresh();
        },
      });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const holder = lead?.assignedToName || lead?.assignedToEmail || L('einem Berater', 'an advisor');

  const actions = lead ? [
    {
      id: 'assign',
      icon: UserCheck,
      label: L('Einem Berater zuweisen', 'Assign to an advisor'),
      description: L('Lead an einen Berater mit aktivem Auftrag senden.', 'Send the lead to an advisor with an active order.'),
      hidden: Boolean(lead.assignedTo) || Boolean(lead.refundedAt),
      disabled: lead.status === 'erledigt',
      disabledReason: L('Erledigte Leads können nicht zugewiesen werden – zuerst Status ändern.', 'Completed leads cannot be assigned – change the status first.'),
      onClick: openAssign,
    },
    {
      id: 'unassign',
      icon: Undo2,
      label: L('Zuweisung aufheben', 'Unassign'),
      description: L('Lead vom Berater zurück in den Pool holen (z. B. falsch zugewiesen).', 'Take the lead back from the advisor into the pool (e.g. assigned by mistake).'),
      hidden: !lead.assignedTo && !lead.requestId,
      disabled: openComplaint,
      disabledReason: complaintReason,
      tone: 'warn',
      onClick: () => dialog.open({
        title: L('Zuweisung aufheben', 'Unassign lead'),
        tone: 'danger',
        description: L(`${lead.fullName} ist aktuell bei ${holder}.`, `${lead.fullName} is currently with ${holder}.`),
        effects: [
          L('Der Lead verschwindet sofort aus „Meine Leads“ des Beraters.', 'The lead disappears immediately from the advisor\'s "My leads".'),
          L('Status wird „Neu“, der Lead liegt wieder im Pool.', 'Status becomes "New" and the lead is back in the pool.'),
          L('Gesprächsstatus, Termin, Wiedervorlage und Berater-Notizen werden gelöscht.', 'Conversation status, appointment, follow-up and advisor notes are deleted.'),
          L('Der Auftrag des Beraters bekommt das Kontingent zurück.', 'The advisor\'s order gets the quota back.'),
        ],
        reason: 'required',
        confirmLabel: L('Zuweisung aufheben', 'Unassign'),
        success: L('Zuweisung aufgehoben.', 'Lead unassigned.'),
        onConfirm: async ({ reason }) => {
          await api.post(`/leads/${id}/unassign`, { reason });
          refresh();
        },
      }),
    },
    {
      id: 'reset',
      icon: ListRestart,
      label: L('Bearbeitungsstand zurücksetzen', 'Reset progress'),
      description: L(
        'Gesprächsstatus, Ergebnis, Termin und Wiedervorlage leeren. Zuweisung bleibt.',
        'Clear conversation status, outcome, appointment and follow-up. The assignment stays.',
      ),
      onClick: () => dialog.open({
        title: L('Bearbeitungsstand zurücksetzen', 'Reset progress'),
        effects: [
          lead.assignedTo
            ? L('Gesprächsstatus wird „Neu“.', 'Conversation status becomes "New".')
            : L('Gesprächsstatus wird geleert.', 'Conversation status is cleared.'),
          L('Ergebnis, Termin und Wiedervorlage werden entfernt (keine Erinnerungen mehr).', 'Outcome, appointment and follow-up are removed (no more reminders).'),
          L('Kontaktdaten und Zuweisung bleiben unverändert.', 'Contact details and assignment stay unchanged.'),
        ],
        reason: 'required',
        confirmLabel: L('Zurücksetzen', 'Reset'),
        success: L('Bearbeitungsstand zurückgesetzt.', 'Progress reset.'),
        onConfirm: async ({ reason }) => {
          await api.post(`/leads/${id}/reset`, { reason });
          refresh();
        },
      }),
    },
    {
      id: 'restore',
      icon: ArchiveRestore,
      label: L('Wieder in den Pool stellen', 'Put back into the pool'),
      description: L('Verworfenen (reklamierten) Lead erneut vergebbar machen.', 'Make a rejected (complained) lead available again.'),
      hidden: !lead.refundedAt,
      onClick: () => dialog.open({
        title: L('Lead wiederherstellen', 'Restore lead'),
        effects: [L(
          'Der Lead wird vom Berater gelöst und steht als „Wieder verfügbar“ im Pool.',
          'The lead is detached from the advisor and is in the pool as "Available again".',
        )],
        reason: 'required',
        confirmLabel: L('Wiederherstellen', 'Restore'),
        success: L('Lead wiederhergestellt.', 'Lead restored.'),
        onConfirm: async ({ reason }) => {
          await api.post(`/leads/${id}/restore`, { reason });
          refresh();
        },
      }),
    },
    {
      id: 'delete',
      icon: Trash2,
      label: L('Lead löschen', 'Delete lead'),
      description: L('Endgültig entfernen, z. B. Testdaten oder Dubletten.', 'Remove permanently, e.g. test data or duplicates.'),
      tone: 'danger',
      disabled: openComplaint,
      disabledReason: complaintReason,
      onClick: () => dialog.open({
        title: L('Lead endgültig löschen', 'Delete lead permanently'),
        tone: 'danger',
        description: L(`${lead.fullName} wird unwiderruflich gelöscht.`, `${lead.fullName} will be deleted permanently.`),
        effects: [
          L('Der Datensatz und seine Reklamationen werden aus der Datenbank entfernt.', 'The record and its complaints are removed from the database.'),
          data?.deliveryLocked
            ? L(`Achtung: der Lead ist bei ${holder} und verschwindet dort sofort.`, `Warning: the lead is with ${holder} and disappears there immediately.`)
            : L('Der Lead ist keinem Berater zugestellt.', 'The lead is not delivered to any advisor.'),
          L('Eine Kopie der Daten bleibt im Aktivitätsprotokoll.', 'A copy of the data stays in the activity log.'),
        ],
        fields: data?.deliveryLocked ? [{
          name: 'force',
          label: L('Zugestellten Lead löschen', 'Delete delivered lead'),
          type: 'checkbox',
          required: true,
          hint: L('Ich weiß, dass der Berater den Lead verliert.', 'I understand the advisor loses this lead.'),
        }] : [],
        reason: 'required',
        confirmText: CONFIRM_DELETE(),
        confirmLabel: L('Endgültig löschen', 'Delete permanently'),
        success: L('Lead gelöscht.', 'Lead deleted.'),
        onConfirm: async ({ reason, values }) => {
          await api.del(`/leads/${id}`, { reason, force: Boolean(values.force) });
          onChanged();
          onClose();
        },
      }),
    },
  ] : [];

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={lead ? lead.fullName || 'Lead' : 'Lead'}
      subtitle={lead ? <>{label(VERTICAL, lead.vertical)} · <CopyId value={lead.id} /></> : null}
      headerExtra={<Button size="sm" tone="ghost" icon={RefreshCw} onClick={reload} aria-label={L('Neu laden', 'Reload')} />}
    >
      {!data && loading ? <Loading /> : null}
      <ErrorBanner error={error} onRetry={reload} />
      {lead ? (
        <>
          <div className="its-drawer-chips">
            <LeadStatus lead={lead} />
            {lead.contactStatus ? <Chip tone="info" icon={false}>{label(CONTACT_STATUS, lead.contactStatus)}</Chip> : null}
            {openComplaint ? <Chip tone="warn">{L('Offene Reklamation', 'Open complaint')}</Chip> : null}
          </div>

          {problems.length ? (
            <div className="its-problem-list">
              {problems.map((problem) => (
                <Banner
                  key={problem.id}
                  tone={problem.severity === 'error' ? 'error' : 'warn'}
                  action={problem.fixLabel ? <Button size="sm" icon={Wrench} onClick={() => fixProblem(problem)}>{L('Beheben', 'Fix')}</Button> : null}
                >
                  <strong>{problem.label}</strong>
                  <small>{problem.help}</small>
                </Banner>
              ))}
            </div>
          ) : null}

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: L('Überblick', 'Overview') },
              { value: 'edit', label: L('Bearbeiten', 'Edit') },
              { value: 'actions', label: L('Aktionen', 'Actions') },
              { value: 'history', label: L('Verlauf', 'History'), count: (data.activity || []).length },
              { value: 'tech', label: L('Technik', 'Technical') },
            ]}
          />

          {tab === 'overview' ? (
            <div className="its-stack">
              <KeyValue items={[
                [L('E-Mail', 'Email'), lead.email],
                [L('Telefon', 'Phone'), lead.phone],
                [L('Adresse', 'Address'), [
                  [lead.street, lead.houseNumber].filter(Boolean).join(' '),
                  [lead.zip, lead.city].filter(Boolean).join(' '),
                ].filter(Boolean).join(', ')],
                [L('Geburtsdatum', 'Date of birth'), lead.dateOfBirth ? formatDate(lead.dateOfBirth) : null],
                [L('Quelle', 'Source'), label(LEAD_SOURCE, lead.source)],
                [L('Paket', 'Package'), label(SCOPE, lead.scope)],
                [L('Berater', 'Advisor'), lead.assignedTo
                  ? `${lead.assignedToName || '—'} (${lead.assignedToEmail || lead.assignedTo})`
                  : L('nicht zugewiesen', 'not assigned')],
                [L('Zugewiesen am', 'Assigned on'), lead.assignedAt ? formatDateTime(lead.assignedAt) : null],
                [L('Gesprächsstatus', 'Conversation status'), label(CONTACT_STATUS, lead.contactStatus)],
                lead.closeOutcome ? [L('Ergebnis', 'Outcome'), label(CLOSE_OUTCOME, lead.closeOutcome)] : null,
                lead.appointmentAt ? [L('Termin', 'Appointment'), formatDateTime(lead.appointmentAt)] : null,
                lead.followUpAt ? [L('Wiedervorlage', 'Follow-up'), formatDateTime(lead.followUpAt)] : null,
                [L('Berater-Notizen', 'Advisor notes'), lead.hasBrokerNotes
                  ? L('vorhanden (privat, hier nicht sichtbar)', 'present (private, not shown here)')
                  : L('keine', 'none')],
                [L('Erstellt', 'Created'), formatDateTime(lead.createdAt)],
                [L('Geändert', 'Updated'), formatDateTime(lead.updatedAt)],
              ]}
              />
              {lead.notes ? <Card title={L('Notizen', 'Notes')}><p className="its-pre">{lead.notes}</p></Card> : null}
              {data.request ? (
                <Card title={L('Auftrag', 'Order')}>
                  <KeyValue items={[
                    ['Code', data.request.code || <CopyId value={data.request.id} />],
                    ['Status', label(REQUEST_STATUS, data.request.status)],
                    [L('Kontingent', 'Quota'), L(
                      `${data.request.validCount} von ${data.request.requestedCount} geliefert · ${data.request.remaining} offen`,
                      `${data.request.validCount} of ${data.request.requestedCount} delivered · ${data.request.remaining} open`,
                    )],
                    [L('Angelegt', 'Created'), formatDateTime(data.request.createdAt)],
                  ]}
                  />
                </Card>
              ) : null}
              {(data.complaints || []).length ? (
                <Card title={L('Reklamationen', 'Complaints')}>
                  <ul className="its-plain-list">
                    {data.complaints.map((entry) => (
                      <li key={entry.id}>
                        <Chip tone={entry.status === 'pending' || entry.status === 'info_needed' ? 'warn' : 'neutral'}>{label(COMPLAINT_STATUS, entry.status)}</Chip>
                        <span>{entry.reason}{entry.comment ? ` – ${entry.comment}` : ''}</span>
                        <small><When value={entry.createdAt} /></small>
                      </li>
                    ))}
                  </ul>
                  <p className="its-muted">{L('Über Reklamationen entscheidet ein Admin im Admin-Portal.', 'Complaints are decided by an admin in the admin portal.')}</p>
                </Card>
              ) : null}
            </div>
          ) : null}

          {tab === 'edit' ? <LeadEditForm lead={lead} deliveryLocked={data.deliveryLocked} onSaved={refresh} /> : null}
          {tab === 'actions' ? <ActionList actions={actions} /> : null}
          {tab === 'history' ? (
            <ActivityTimeline entries={data.activity} empty={L('IT-Support hat an diesem Lead noch nichts geändert.', 'IT Support has not changed anything on this lead yet.')} />
          ) : null}
          {tab === 'tech' ? (
            <KeyValue items={Object.entries(data.technical).map(([key, value]) => [
              key,
              typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? <CopyId value={value} full /> : (value === null ? null : String(value)),
            ])}
            />
          ) : null}
          {dialog.element}
        </>
      ) : null}
    </Drawer>
  );
}

/* ---------------- list ---------------- */

export default function LeadsPage({ onChanged }) {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(new Set());
  const dialog = useActionDialog();
  const filters = {
    q: params.get('q') || '',
    status: params.get('status') || '',
    contactStatus: params.get('contactStatus') || '',
    assignment: params.get('assignment') || '',
    vertical: params.get('vertical') || '',
    source: params.get('source') || '',
    problem: params.get('problem') || '',
    page: Number(params.get('page')) || 1,
  };
  const openId = params.get('id');
  const { data, error, loading, reload } = useApi('/leads', { ...filters, limit: 25 });

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in patch) && !('id' in patch)) next.delete('page');
    setParams(next, { replace: !('id' in patch) });
    if (!('id' in patch)) setSelected(new Set());
  };

  const changed = useCallback(() => {
    reload();
    onChanged?.();
  }, [reload, onChanged]);

  const problem = LEAD_PROBLEMS.find((entry) => entry.value === filters.problem);
  const all = L('Alle', 'All');

  const fixAll = () => dialog.open({
    title: L(`Alle beheben: ${pick(problem.label)}`, `Fix all: ${pick(problem.label)}`),
    effects: [
      L(
        `Die automatische Korrektur wird auf alle ${data?.total || 0} betroffenen Leads angewendet (max. 500).`,
        `The automatic fix is applied to all ${data?.total || 0} affected leads (max. 500).`,
      ),
      L('Jede Änderung wird einzeln protokolliert.', 'Every change is logged individually.'),
    ],
    reason: 'required',
    confirmLabel: L('Alle beheben', 'Fix all'),
    success: (result) => L(`${result?.fixed ?? 0} Lead(s) korrigiert.`, `${result?.fixed ?? 0} lead(s) fixed.`),
    onConfirm: async ({ reason }) => {
      const result = await api.post('/leads/fix-all', { checkId: problem.value, reason });
      changed();
      return result;
    },
  });

  const bulkDelete = () => dialog.open({
    title: L(`${selected.size} Lead(s) löschen`, `Delete ${selected.size} lead(s)`),
    tone: 'danger',
    effects: [
      L('Die ausgewählten Leads werden endgültig gelöscht.', 'The selected leads are deleted permanently.'),
      L('Leads mit offener Reklamation werden übersprungen.', 'Leads with an open complaint are skipped.'),
      L(
        'Zugestellte Leads werden nur gelöscht, wenn Sie das unten ausdrücklich erlauben.',
        'Delivered leads are only deleted if you explicitly allow it below.',
      ),
    ],
    fields: [{
      name: 'force',
      label: L('Zugestellte Leads', 'Delivered leads'),
      type: 'checkbox',
      hint: L('Auch Leads löschen, die bereits bei einem Berater sind.', 'Also delete leads that are already with an advisor.'),
    }],
    reason: 'required',
    confirmText: CONFIRM_DELETE(),
    confirmLabel: L('Endgültig löschen', 'Delete permanently'),
    success: (result) => L(
      `${result?.deleted?.length || 0} gelöscht${result?.skipped?.length ? `, ${result.skipped.length} übersprungen` : ''}.`,
      `${result?.deleted?.length || 0} deleted${result?.skipped?.length ? `, ${result.skipped.length} skipped` : ''}.`,
    ),
    onConfirm: async ({ reason, values }) => {
      const result = await api.post('/leads/bulk-delete', { ids: [...selected], reason, force: Boolean(values.force) });
      setSelected(new Set());
      changed();
      return result;
    },
  });

  const columns = [
    {
      key: 'name',
      label: 'Lead',
      render: (lead) => (
        <div className="its-cell-main">
          <strong>{lead.fullName || '—'}</strong>
          <small>{lead.email || lead.phone || '—'}</small>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (lead) => (
        <div className="its-cell-chips">
          <LeadStatus lead={lead} />
          {lead.openComplaint ? <Chip tone="warn" icon={false}>{L('Reklamation', 'Complaint')}</Chip> : null}
        </div>
      ),
    },
    { key: 'contact', label: L('Gespräch', 'Conversation'), render: (lead) => label(CONTACT_STATUS, lead.contactStatus) },
    {
      key: 'berater',
      label: L('Berater', 'Advisor'),
      render: (lead) => (lead.assignedTo
        ? (lead.assignedToName || lead.assignedToEmail || L('Unbekannt', 'Unknown'))
        : <span className="its-muted">Pool</span>),
    },
    { key: 'vertical', label: L('Bereich', 'Area'), render: (lead) => label(VERTICAL, lead.vertical) },
    { key: 'source', label: L('Quelle', 'Source'), render: (lead) => label(LEAD_SOURCE, lead.source) },
    { key: 'created', label: L('Erstellt', 'Created'), render: (lead) => <When value={lead.createdAt} /> },
  ];

  return (
    <Page
      title="Leads"
      description={L(
        'Alle Leads der Plattform suchen, prüfen, korrigieren, neu zuweisen oder löschen.',
        'Search, check, correct, reassign or delete every lead on the platform.',
      )}
      actions={<Button icon={RefreshCw} loading={loading} onClick={reload}>{L('Aktualisieren', 'Refresh')}</Button>}
    >
      <Toolbar>
        <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder={L('Name, E-Mail, Telefon, PLZ, ID …', 'Name, email, phone, postcode, ID …')} />
        <Select label="Status" value={filters.status} onChange={(status) => update({ status })} options={mapOptions(LEAD_STATUS, all)} />
        <Select
          label={L('Gespräch', 'Conversation')}
          value={filters.contactStatus}
          onChange={(contactStatus) => update({ contactStatus })}
          options={[...mapOptions(CONTACT_STATUS, all), { value: 'none', label: L('Ohne', 'None') }]}
        />
        <Select
          label={L('Zuweisung', 'Assignment')}
          value={filters.assignment}
          onChange={(assignment) => update({ assignment })}
          options={[
            { value: '', label: L('Alle aktiven', 'All active') },
            { value: 'unassigned', label: L('Im Pool', 'In pool') },
            { value: 'assigned', label: L('Bei Berater', 'With advisor') },
            { value: 'rejected', label: L('Verworfen', 'Rejected') },
          ]}
        />
        <Select label={L('Bereich', 'Area')} value={filters.vertical} onChange={(vertical) => update({ vertical })} options={mapOptions(VERTICAL, all)} />
        <Select label={L('Quelle', 'Source')} value={filters.source} onChange={(source) => update({ source })} options={mapOptions(LEAD_SOURCE, all)} />
        <Select
          label={L('Problem', 'Problem')}
          value={filters.problem}
          onChange={(value) => update({ problem: value })}
          options={[{ value: '', label: '—' }, ...LEAD_PROBLEMS.map((entry) => ({ value: entry.value, label: pick(entry.label) }))]}
        />
      </Toolbar>

      {problem ? (
        <Banner
          tone="warn"
          action={problem.fixable && data?.total ? <Button size="sm" icon={Wrench} onClick={fixAll}>{L('Alle beheben', 'Fix all')}</Button> : null}
        >
          {L('Gefiltert nach Datenproblem ', 'Filtered by data problem ')}<strong>{pick(problem.label)}</strong>.
          {problem.fixable
            ? L(
              ' Einzelne Leads öffnen und „Beheben“ wählen – oder alle auf einmal korrigieren.',
              ' Open single leads and choose "Fix" – or correct all of them at once.',
            )
            : L(' Bitte die Leads einzeln prüfen und manuell korrigieren.', ' Please check the leads one by one and correct them manually.')}
        </Banner>
      ) : null}

      {selected.size ? (
        <div className="its-bulkbar">
          <span>{L(`${selected.size} ausgewählt`, `${selected.size} selected`)}</span>
          <Button size="sm" tone="ghost" onClick={() => setSelected(new Set())}>{L('Auswahl aufheben', 'Clear selection')}</Button>
          <Button size="sm" tone="danger" icon={Eraser} onClick={bulkDelete}>{L('Ausgewählte löschen', 'Delete selected')}</Button>
        </div>
      ) : null}

      <ErrorBanner error={error} onRetry={reload} />
      <Card flush>
        <DataTable
          columns={columns}
          rows={data?.leads || []}
          loading={loading}
          onRowClick={(lead) => update({ id: lead.id })}
          activeKey={openId}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          empty={(
            <EmptyState title={L('Keine Leads gefunden', 'No leads found')}>
              {L('Filter anpassen oder Suche ändern.', 'Adjust the filters or change the search.')}
            </EmptyState>
          )}
        />
        <Pagination page={filters.page} limit={data?.limit || 25} total={data?.total || 0} onPage={(page) => update({ page })} />
      </Card>

      <LeadDrawer id={openId} onClose={() => update({ id: '' })} onChanged={changed} />
      {dialog.element}
    </Page>
  );
}
