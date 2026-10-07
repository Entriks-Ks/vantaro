import { useEffect, useMemo, useState } from 'react';
import { Pencil, Percent, Trash2 } from 'lucide-react';
import {
  appliesToLabel,
  createBeraterDiscount,
  deleteBeraterDiscount,
  discountKindLabel,
  discountStatusLabel,
  discountValueLabel,
  fetchBeraterDiscounts,
  isDiscountExpired,
  remainingTimeLabel,
  revokeBeraterDiscount,
  updateBeraterDiscount,
} from '../../lib/discounts';
import { formatDate, formatDateTime, formatEuroExact } from './helpers';

function eurosToCents(raw) {
  const normalized = String(raw || '').trim().replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function toLocalInput(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formFromDiscount(entry) {
  return {
    kind: entry.kind,
    valueType: entry.valueType,
    value: entry.valueType === 'percent'
      ? String(entry.value)
      : (Number(entry.value) / 100).toFixed(2).replace('.', ','),
    appliesTo: entry.appliesTo || 'all',
    code: entry.code || '',
    note: entry.note || '',
    expiresAt: toLocalInput(entry.expiresAt),
  };
}

const EMPTY_FORM = {
  kind: 'standing',
  valueType: 'percent',
  value: '',
  appliesTo: 'all',
  code: '',
  note: '',
  expiresAt: '',
};

function DiscountActions({ entry, busyId, onEdit, onRevoke, onDelete }) {
  const busy = busyId === entry.id;
  const canChange = entry.status === 'active';
  const canDelete = entry.status !== 'reserved';
  return (
    <div className="dash-bv-disc-actions">
      {canChange ? (
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => onEdit(entry)}>
          <Pencil size={14} aria-hidden="true" />
          Bearbeiten
        </button>
      ) : null}
      {canChange ? (
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => onRevoke(entry.id)}>
          {busy ? '…' : 'Entziehen'}
        </button>
      ) : null}
      {canDelete ? (
        <button type="button" className="btn btn-outline dash-bv-disc-actions__danger" disabled={busy} onClick={() => onDelete(entry.id)}>
          <Trash2 size={14} aria-hidden="true" />
          Löschen
        </button>
      ) : (
        <small>Offene Zahlung</small>
      )}
    </div>
  );
}

export function DiscountsPanel({ beraterId, payments = [] }) {
  const [discounts, setDiscounts] = useState([]);
  const [paidUnits, setPaidUnits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    const payload = await fetchBeraterDiscounts(beraterId);
    setDiscounts(payload.discounts || []);
    setPaidUnits(Number(payload.paidUnits) || 0);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [beraterId]);

  const standing = discounts.find((entry) => entry.kind === 'standing' && entry.status === 'active' && !isDiscountExpired(entry)) || null;
  const oneTimes = discounts.filter((entry) => entry.kind === 'one_time');
  const unusedOneTimes = oneTimes.filter((entry) => (
    (entry.status === 'active' || entry.status === 'reserved') && !isDiscountExpired(entry)
  ));
  const history = discounts.filter((entry) => (
    entry.status === 'consumed'
    || entry.status === 'revoked'
    || (entry.kind === 'standing' && entry.status !== 'active')
    || isDiscountExpired(entry)
  ));
  const paymentUnits = payments
    .filter((entry) => entry.status === 'paid')
    .reduce((sum, entry) => sum + (Number(entry.leadCount) || 0), 0);
  const units = paidUnits || paymentUnits;
  const editing = discounts.find((entry) => entry.id === editingId) || null;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const payloadFromForm = () => {
    const payload = {
      beraterId,
      kind: form.kind,
      valueType: form.valueType,
      appliesTo: form.appliesTo,
      code: form.code.trim() || undefined,
      note: form.note.trim(),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };
    if (form.valueType === 'percent') {
      payload.value = Number(form.value);
    } else {
      const cents = eurosToCents(form.value);
      if (cents == null) throw new Error('Bitte einen gültigen Betrag je Einheit angeben.');
      payload.valueCents = cents;
    }
    return payload;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = payloadFromForm();
      if (editingId) await updateBeraterDiscount(editingId, payload);
      else await createBeraterDiscount(payload);
      setForm(EMPTY_FORM);
      setEditingId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry) => {
    setError('');
    setEditingId(entry.id);
    setForm(formFromDiscount(entry));
    window.document.getElementById('dash-discount-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => {
    setEditingId('');
    setForm(EMPTY_FORM);
  };

  const revoke = async (id) => {
    if (!id || busyId) return;
    setBusyId(id);
    setError('');
    try {
      await revokeBeraterDiscount(id);
      if (editingId === id) cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const remove = async (id) => {
    if (!id || busyId) return;
    const ok = window.confirm('Diesen Rabatt unwiderruflich löschen?');
    if (!ok) return;
    setBusyId(id);
    setError('');
    try {
      await deleteBeraterDiscount(id);
      if (editingId === id) cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const rows = useMemo(() => discounts, [discounts]);

  if (loading) {
    return (
      <div className="dash-bv-panel">
        <div className="dash-empty"><p>Rabatte werden geladen…</p></div>
      </div>
    );
  }

  return (
    <div className="dash-bv-panel dash-bv-panel--discounts">
      <div className="dash-bv-metrics">
        <div className="dash-metric">
          <span>Bezahlte Einheiten</span>
          <strong>{units}</strong>
          <small>Hinweis für Treue-Rabatte, keine Automatik</small>
        </div>
        <div className="dash-metric">
          <span>Dauerkondition</span>
          <strong>{standing ? discountValueLabel(standing, formatEuroExact) : '—'}</strong>
          <small>{standing ? appliesToLabel(standing.appliesTo) : 'Keine aktive Kondition'}</small>
        </div>
        <div className="dash-metric">
          <span>Offene Einmal-Rabatte</span>
          <strong>{unusedOneTimes.length}</strong>
          <small>Berater löst ihn beim Buchen selbst ein</small>
        </div>
      </div>

      {error ? (
        <div className="dash-empty">
          <p>{error}</p>
        </div>
      ) : null}

      {standing ? (
        <section className="dash-bv-card">
          <header>
            <div>
              <h3>Aktive Dauerkondition</h3>
              <p>Gilt automatisch bis sie entzogen, gelöscht oder das optionale Datum erreicht ist.</p>
            </div>
          </header>
          <article className="dash-bv-pay-row">
            <div>
              <strong>{standing.code}</strong>
              <span>
                {discountValueLabel(standing, formatEuroExact)} · {appliesToLabel(standing.appliesTo)}
                {standing.expiresAt ? ` · bis ${formatDateTime(standing.expiresAt)}` : ' · ohne Ablauf'}
                {standing.note ? ` · ${standing.note}` : ''}
              </span>
            </div>
            <div className="dash-bv-pay-row__side">
              <small>{formatDate(standing.createdAt)}</small>
              <DiscountActions
                entry={standing}
                busyId={busyId}
                onEdit={startEdit}
                onRevoke={revoke}
                onDelete={remove}
              />
            </div>
          </article>
        </section>
      ) : null}

      <section className="dash-bv-card" id="dash-discount-form">
        <header>
          <div>
            <h3>{editing ? 'Rabatt bearbeiten' : 'Rabatt anlegen'}</h3>
            <p>
              {editing
                ? `${discountKindLabel(editing.kind)} ${editing.code || ''}`.trim()
                : 'Dauerkondition gilt automatisch. Einmal-Rabatt löst der Berater selbst ein. Ablaufdatum ist optional.'}
            </p>
          </div>
        </header>
        <form className="dash-form dash-form--workflow" onSubmit={submit}>
          <label>
            Art
            <select
              value={form.kind}
              disabled={Boolean(editingId)}
              onChange={(event) => setField('kind', event.target.value)}
            >
              <option value="standing">Dauerkondition</option>
              <option value="one_time">Einmal-Rabatt</option>
            </select>
          </label>
          <label>
            Gilt für
            <select value={form.appliesTo} onChange={(event) => setField('appliesTo', event.target.value)}>
              <option value="all">Alle Pakete</option>
              <option value="leads">Nur Leads</option>
              <option value="appointments">Nur Termine</option>
            </select>
          </label>
          <label>
            Typ
            <select value={form.valueType} onChange={(event) => setField('valueType', event.target.value)}>
              <option value="percent">Prozent</option>
              <option value="fixed_cents">Betrag je Einheit</option>
            </select>
          </label>
          <label>
            {form.valueType === 'percent' ? 'Prozent' : 'Betrag je Lead/Termin (€)'}
            <input
              value={form.value}
              onChange={(event) => setField('value', event.target.value)}
              inputMode={form.valueType === 'percent' ? 'numeric' : 'decimal'}
              placeholder={form.valueType === 'percent' ? 'z. B. 20' : 'z. B. 15,00'}
              required
            />
          </label>
          <label>
            Code (optional)
            <input
              value={form.code}
              onChange={(event) => setField('code', event.target.value)}
              placeholder="z. B. VIP-20"
            />
          </label>
          <label>
            Gültig bis (optional)
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setField('expiresAt', event.target.value)}
            />
          </label>
          <label className="is-full">
            Interne Notiz
            <input
              value={form.note}
              onChange={(event) => setField('note', event.target.value)}
              placeholder="z. B. wichtiger Partner, 50+ Leads"
            />
          </label>
          <div className="is-full dash-bv-disc-form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Percent size={15} aria-hidden="true" />
              {saving ? 'Wird gespeichert…' : editingId ? 'Änderungen speichern' : form.kind === 'standing' ? 'Dauerkondition speichern' : 'Einmal-Rabatt speichern'}
            </button>
            {editingId ? (
              <button type="button" className="btn btn-outline" disabled={saving} onClick={cancelEdit}>
                Abbrechen
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {unusedOneTimes.length ? (
        <section className="dash-bv-card dash-bv-card--list">
          <header>
            <div>
              <h3>Offene Einmal-Rabatte</h3>
              <p>Bearbeiten, entziehen (stoppen) oder löschen.</p>
            </div>
          </header>
          <div className="dash-bv-pay-list">
            {unusedOneTimes.map((entry) => (
              <article key={entry.id} className="dash-bv-pay-row">
                <div>
                  <strong>{entry.code}</strong>
                  <span>
                    {discountValueLabel(entry, formatEuroExact)} · {appliesToLabel(entry.appliesTo)}
                    {' · '}
                    {discountStatusLabel(entry.status)}
                    {entry.expiresAt ? ` · bis ${formatDateTime(entry.expiresAt)}${remainingTimeLabel(entry.expiresAt) ? ` (${remainingTimeLabel(entry.expiresAt)})` : ''}` : ''}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </span>
                </div>
                <div className="dash-bv-pay-row__side">
                  <DiscountActions
                    entry={entry}
                    busyId={busyId}
                    onEdit={startEdit}
                    onRevoke={revoke}
                    onDelete={remove}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {history.length ? (
        <section className="dash-bv-card dash-bv-card--list">
          <header>
            <div>
              <h3>Verlauf</h3>
              <p>{history.length} frühere Kondition{history.length === 1 ? '' : 'en'}</p>
            </div>
          </header>
          <div className="dash-bv-pay-list">
            {history.map((entry) => (
              <article key={entry.id} className="dash-bv-pay-row">
                <div>
                  <strong>{entry.code}</strong>
                  <span>
                    {discountKindLabel(entry.kind)} · {discountValueLabel(entry, formatEuroExact)}
                    {' · '}
                    {isDiscountExpired(entry) && entry.status === 'active' ? 'Abgelaufen' : discountStatusLabel(entry.status)}
                  </span>
                </div>
                <div className="dash-bv-pay-row__side">
                  <small>{formatDate(entry.consumedAt || entry.revokedAt || entry.createdAt)}</small>
                  <DiscountActions
                    entry={entry}
                    busyId={busyId}
                    onEdit={startEdit}
                    onRevoke={revoke}
                    onDelete={remove}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!rows.length && !error ? (
        <div className="dash-empty">
          <p>Für diesen Berater ist noch kein Rabatt hinterlegt.</p>
        </div>
      ) : null}
    </div>
  );
}
