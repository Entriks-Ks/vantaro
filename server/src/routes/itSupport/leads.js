import { Router } from 'express';
import { supabase } from '../../lib/supabase.js';
import {
  CONTACT_STATUSES,
  isLeadDeliveryLocked,
  isUuid,
  LEAD_SOURCES,
  LEAD_STATUSES,
  restoreRejectedLead,
  updateLead,
  withAssignees,
} from '../../lib/leads.js';
import {
  assignLeadToBerater,
  getRequestById,
  listAllRequests,
  statsForRequests,
  toPublicRequest,
} from '../../lib/leadRequests.js';
import { openComplaintLeadIds } from '../../lib/complaints.js';
import { verticalOrInsurance } from '../../lib/vertical.js';
import { diffFields, listActivityFor, logItAction, logItActions } from '../../lib/itSupportAudit.js';
import { leadCheck, leadProblems, pick } from '../../lib/itSupportChecks.js';
import { fail, optionalReason, pageParams, requireDb, requireReason, route, searchTerm } from './common.js';
import { both, langOf, tr } from './i18n.js';
import {
  afterLeadChange,
  assertNoOpenComplaint,
  consoleLead,
  leadLabel,
  loadLead,
  publicLead,
  SCHEDULE_CLEAR,
  updateLeadRow,
} from './leadOps.js';

const router = Router();

const EDITABLE_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'street', 'houseNumber', 'zip', 'city', 'state', 'dateOfBirth',
  'notes', 'status', 'contactStatus', 'closeOutcome', 'appointmentAt', 'followUpAt', 'scope',
];

function uuidParam(req) {
  if (!isUuid(req.params.id)) throw fail(tr(req)('Lead wurde nicht gefunden.', 'Lead not found.'), 404);
  return req.params.id;
}

router.get('/', route(async (req, res) => {
  requireDb(req);
  const { limit, page, from, to } = pageParams(req, { def: 25, max: 100 });
  let query = supabase.from('leads').select('*', { count: 'exact' }).order('created_at', { ascending: false });

  const status = String(req.query.status || '');
  if (LEAD_STATUSES.includes(status)) query = query.eq('status', status);
  const contact = String(req.query.contactStatus || '');
  if (contact === 'none') query = query.is('contact_status', null);
  else if (CONTACT_STATUSES.includes(contact)) query = query.eq('contact_status', contact);
  const source = String(req.query.source || '');
  if (LEAD_SOURCES.includes(source)) query = query.eq('source', source);
  const vertical = String(req.query.vertical || '');
  if (vertical === 'energy' || vertical === 'insurance') query = query.eq('vertical', vertical);

  const assignment = String(req.query.assignment || '');
  if (assignment === 'unassigned') query = query.is('assigned_to', null).is('refunded_at', null);
  else if (assignment === 'assigned') query = query.not('assigned_to', 'is', null).is('refunded_at', null);
  else if (assignment === 'rejected') query = query.not('refunded_at', 'is', null);
  if (isUuid(req.query.beraterId)) query = query.eq('assigned_to', req.query.beraterId);

  const check = leadCheck(String(req.query.problem || ''));
  if (check) query = check.apply(query);

  const raw = String(req.query.q || '').trim();
  if (isUuid(raw)) {
    query = query.eq('id', raw);
  } else {
    const q = searchTerm(raw);
    if (q) {
      const pattern = `"%${q}%"`;
      query = query.or([
        `first_name.ilike.${pattern}`, `last_name.ilike.${pattern}`, `email.ilike.${pattern}`,
        `phone.ilike.${pattern}`, `city.ilike.${pattern}`, `zip.ilike.${pattern}`, `external_id.ilike.${pattern}`,
      ].join(','));
    }
  }

  let { data, count, error } = await query.range(from, to);
  if (error && /external_id/i.test(error.message || '')) {
    // lead_external_id.sql not run: search without the external id column.
    const q = searchTerm(raw);
    const retry = supabase.from('leads').select('*', { count: 'exact' }).order('created_at', { ascending: false })
      .or(['first_name', 'last_name', 'email', 'phone', 'city', 'zip'].map((col) => `${col}.ilike."%${q}%"`).join(','));
    ({ data, count, error } = await retry.range(from, to));
  }
  if (error) throw error;
  const leads = (await withAssignees(data || [])).map(consoleLead);
  const complaints = await openComplaintLeadIds(leads.map((lead) => lead.id));
  res.json({
    leads: leads.map((lead) => ({ ...lead, openComplaint: complaints.has(lead.id) })),
    total: count || 0,
    page,
    limit,
  });
}));

router.get('/:id', route(async (req, res) => {
  requireDb(req);
  const row = await loadLead(uuidParam(req), tr(req));
  const [lead, problems, activity] = await Promise.all([
    publicLead(row),
    leadProblems(row.id, langOf(req)),
    listActivityFor('lead', row.id),
  ]);

  let request = null;
  if (row.request_id) {
    const requestRow = await getRequestById(row.request_id).catch(() => null);
    if (requestRow) {
      const stats = await statsForRequests([requestRow.id]).catch(() => new Map());
      request = toPublicRequest(requestRow, stats.get(requestRow.id));
    }
  }

  let complaints = [];
  const { data: complaintRows, error: complaintError } = await supabase
    .from('lead_complaints')
    .select('id, status, reason, comment, admin_note, created_at, reviewed_at')
    .eq('lead_id', row.id)
    .order('created_at', { ascending: false });
  if (!complaintError) {
    complaints = (complaintRows || []).map((entry) => ({
      id: entry.id,
      status: entry.status,
      reason: entry.reason,
      comment: entry.comment,
      adminNote: entry.admin_note,
      createdAt: entry.created_at,
      reviewedAt: entry.reviewed_at,
    }));
  }

  res.json({
    lead,
    problems,
    activity,
    request,
    complaints,
    deliveryLocked: isLeadDeliveryLocked(row),
    technical: {
      id: row.id,
      status: row.status,
      contactStatus: row.contact_status ?? null,
      assignedTo: row.assigned_to,
      assignedAt: row.assigned_at,
      requestId: row.request_id,
      refundedAt: row.refunded_at ?? null,
      reportedAt: row.reported_at ?? null,
      source: row.source,
      externalSource: row.external_source ?? null,
      externalId: row.external_id ?? null,
      energyHolderId: row.energy_holder_id ?? null,
      calendarSyncStatus: row.calendar_sync_status ?? null,
      appointmentRemindedAt: row.appointment_reminded_at ?? null,
      appointmentSoonRemindedAt: row.appointment_soon_reminded_at ?? null,
      followUpRemindedAt: row.follow_up_reminded_at ?? null,
      followUpSoonRemindedAt: row.follow_up_soon_reminded_at ?? null,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
}));

router.patch('/:id', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const current = await loadLead(uuidParam(req), t);
  const payload = {};
  for (const key of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) payload[key] = req.body[key];
  }
  if (!Object.keys(payload).length) throw fail(t('Keine Änderungen übermittelt.', 'No changes submitted.'));

  const before = await publicLead(current);
  const updated = await updateLead(current.id, payload, { bypassDeliveryLock: true });
  if (!updated) throw fail(t('Lead wurde nicht gefunden.', 'Lead not found.'), 404);
  const after = consoleLead(updated);
  const diff = diffFields(before, after, EDITABLE_FIELDS);

  if (diff.changed.length) {
    await logItAction(req, {
      action: 'lead.update',
      targetType: 'lead',
      targetId: current.id,
      targetLabel: leadLabel(current),
      reason: optionalReason(req),
      summary: both(`Felder geändert: ${diff.changed.join(', ')}`, `Fields changed: ${diff.changed.join(', ')}`),
      before: diff.before,
      after: diff.after,
    });
    const next = await loadLead(current.id, t);
    afterLeadChange(current, next);
  }
  res.json({ lead: after, changed: diff.changed });
}));

router.get('/:id/assign-options', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const row = await loadLead(uuidParam(req), t);
  const vertical = verticalOrInsurance(row.vertical);
  const requests = (await listAllRequests())
    .filter((entry) => entry.status === 'active' && entry.remaining > 0 && entry.vertical === vertical)
    .map((entry) => ({
      requestId: entry.id,
      code: entry.code,
      beraterId: entry.beraterId,
      beraterName: entry.berater?.fullName || entry.berater?.email || t('Unbekannt', 'Unknown'),
      beraterEmail: entry.berater?.email || null,
      leadType: entry.leadType,
      scope: entry.scope,
      remaining: entry.remaining,
      requestedCount: entry.requestedCount,
    }));
  res.json({ options: requests });
}));

router.post('/:id/assign', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const current = await loadLead(uuidParam(req), t);
  if (current.assigned_to) {
    throw fail(t(
      'Der Lead ist bereits einem Berater zugewiesen. Bitte zuerst „Zuweisung aufheben“ ausführen.',
      'The lead is already assigned to an advisor. Please run "Unassign" first.',
    ), 409);
  }
  const reason = optionalReason(req);
  const result = await assignLeadToBerater(current.id, req.body?.beraterId, { requestId: req.body?.requestId });
  if (!result?.lead) throw fail(t('Lead wurde nicht gefunden.', 'Lead not found.'), 404);
  const name = result.lead.assignedToName || result.lead.assignedToEmail || req.body?.beraterId;
  const code = result.request?.code;
  await logItAction(req, {
    action: 'lead.assign',
    targetType: 'lead',
    targetId: current.id,
    targetLabel: leadLabel(current),
    reason,
    summary: both(
      `Zugewiesen an ${name}${code ? ` (Auftrag ${code})` : ''}`,
      `Assigned to ${name}${code ? ` (order ${code})` : ''}`,
    ),
    before: { assignedTo: null, status: current.status, requestId: current.request_id },
    after: { assignedTo: result.lead.assignedTo, status: result.lead.status, requestId: result.lead.requestId },
  });
  res.json({ lead: consoleLead(result.lead), request: result.request || null });
}));

router.post('/:id/unassign', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const reason = requireReason(req);
  const current = await loadLead(uuidParam(req), t);
  if (!current.assigned_to && !current.request_id) throw fail(t('Der Lead ist keinem Berater zugewiesen.', 'The lead is not assigned to an advisor.'));
  await assertNoOpenComplaint(current.id, t, ['Das Aufheben der Zuweisung', 'Unassigning']);

  const before = await publicLead(current);
  const next = await updateLeadRow(current.id, {
    assigned_to: null,
    assigned_at: null,
    request_id: null,
    refunded_at: null,
    reported_at: null,
    status: 'neu',
    // The next Berater starts fresh: progress and private notes of the previous one are removed.
    contact_status: null,
    close_outcome: null,
    broker_notes: null,
    energy_holder_id: null,
    ...SCHEDULE_CLEAR,
  });
  const previous = before.assignedToName || before.assignedToEmail || current.assigned_to || '—';
  await logItAction(req, {
    action: 'lead.unassign',
    targetType: 'lead',
    targetId: current.id,
    targetLabel: leadLabel(current),
    reason,
    summary: both(
      `Zuweisung an ${previous} aufgehoben, Lead zurück im Pool`,
      `Unassigned from ${previous}, lead back in the pool`,
    ),
    before: { assignedTo: current.assigned_to, assignedToName: before.assignedToName, requestId: current.request_id, status: current.status, contactStatus: current.contact_status },
    after: { assignedTo: null, requestId: null, status: 'neu', contactStatus: null },
  });
  afterLeadChange(current, next);
  res.json({ lead: await publicLead(next) });
}));

router.post('/:id/reset', route(async (req, res) => {
  requireDb(req);
  const reason = requireReason(req);
  const current = await loadLead(uuidParam(req), tr(req));
  const before = await publicLead(current);
  const next = await updateLeadRow(current.id, {
    contact_status: current.assigned_to ? 'neu' : null,
    close_outcome: null,
    ...SCHEDULE_CLEAR,
  });
  const after = await publicLead(next);
  const keys = ['contactStatus', 'closeOutcome', 'appointmentAt', 'followUpAt'];
  const diff = diffFields(before, after, keys);
  await logItAction(req, {
    action: 'lead.reset',
    targetType: 'lead',
    targetId: current.id,
    targetLabel: leadLabel(current),
    reason,
    summary: both(
      'Bearbeitungsstand zurückgesetzt (Gesprächsstatus, Ergebnis, Termin, Wiedervorlage)',
      'Progress reset (conversation status, outcome, appointment, follow-up)',
    ),
    before: diff.before,
    after: diff.after,
  });
  afterLeadChange(current, next);
  res.json({ lead: after });
}));

router.post('/:id/restore', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const reason = requireReason(req);
  const current = await loadLead(uuidParam(req), t);
  const lead = await restoreRejectedLead(current.id);
  if (!lead) throw fail(t('Lead wurde nicht gefunden.', 'Lead not found.'), 404);
  await logItAction(req, {
    action: 'lead.restore',
    targetType: 'lead',
    targetId: current.id,
    targetLabel: leadLabel(current),
    reason,
    summary: both('Verworfenen Lead wieder in den Pool gestellt', 'Rejected lead put back into the pool'),
    before: { refundedAt: current.refunded_at, assignedTo: current.assigned_to, status: current.status },
    after: { refundedAt: null, assignedTo: null, status: lead.status },
  });
  afterLeadChange(current, { ...current, request_id: null });
  res.json({ lead: consoleLead(lead) });
}));

router.post('/:id/fix', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const current = await loadLead(uuidParam(req), t);
  const check = leadCheck(String(req.body?.checkId || ''));
  if (!check?.fix) throw fail(t('Für dieses Problem gibt es keine automatische Korrektur.', 'There is no automatic fix for this problem.'));
  const { data: match } = await check.apply(supabase.from('leads').select('id').eq('id', current.id)).maybeSingle();
  if (!match) throw fail(t('Das Problem besteht bei diesem Lead nicht mehr.', 'This lead no longer has the problem.'), 409);
  const next = await updateLeadRow(current.id, check.fix.patch);
  await logItAction(req, {
    action: 'lead.fix',
    targetType: 'lead',
    targetId: current.id,
    targetLabel: leadLabel(current),
    reason: optionalReason(req) || pick(check.label, langOf(req)),
    summary: both(
      `Datenprüfung „${pick(check.label, 'de')}“: ${pick(check.fix.label, 'de')}`,
      `Data check "${pick(check.label, 'en')}": ${pick(check.fix.label, 'en')}`,
    ),
    before: Object.fromEntries(Object.keys(check.fix.patch).map((key) => [key, current[key] ?? null])),
    after: check.fix.patch,
  });
  afterLeadChange(current, next);
  res.json({ lead: await publicLead(next) });
}));

router.post('/fix-all', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const reason = requireReason(req);
  const check = leadCheck(String(req.body?.checkId || ''));
  if (!check?.fix) throw fail(t('Für dieses Problem gibt es keine automatische Korrektur.', 'There is no automatic fix for this problem.'));
  const { data, error } = await check.apply(supabase.from('leads').select('*')).limit(500);
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return res.json({ fixed: 0 });
  const ids = rows.map((row) => row.id);
  const { error: updateError } = await supabase.from('leads').update(check.fix.patch).in('id', ids);
  if (updateError) throw updateError;
  await logItActions(req, rows.map((row) => ({
    action: 'lead.fix',
    targetType: 'lead',
    targetId: row.id,
    targetLabel: leadLabel(row),
    reason,
    summary: both(
      `Datenprüfung „${pick(check.label, 'de')}“ (Sammelkorrektur): ${pick(check.fix.label, 'de')}`,
      `Data check "${pick(check.label, 'en')}" (bulk fix): ${pick(check.fix.label, 'en')}`,
    ),
    before: Object.fromEntries(Object.keys(check.fix.patch).map((key) => [key, row[key] ?? null])),
    after: check.fix.patch,
  })));
  rows.forEach((row) => afterLeadChange(row, { ...row, ...check.fix.patch }));
  res.json({ fixed: rows.length });
}));

async function deleteLeads(req, ids, { force, reason }) {
  const t = tr(req);
  const { data, error } = await supabase.from('leads').select('*').in('id', ids);
  if (error) throw error;
  const rows = data || [];
  const complaints = await openComplaintLeadIds(rows.map((row) => row.id));
  const skipped = [];
  const deletable = [];
  for (const row of rows) {
    if (complaints.has(row.id)) skipped.push({ id: row.id, label: leadLabel(row), code: 'open_complaint', reason: t('Offene Reklamation', 'Open complaint') });
    else if (isLeadDeliveryLocked(row) && !force) skipped.push({ id: row.id, label: leadLabel(row), code: 'delivered', reason: t('Bereits an einen Berater zugestellt', 'Already delivered to an advisor') });
    else deletable.push(row);
  }
  for (const id of ids) {
    if (!rows.some((row) => row.id === id)) skipped.push({ id, label: id, code: 'not_found', reason: t('Nicht gefunden', 'Not found') });
  }
  if (deletable.length) {
    const { error: deleteError } = await supabase.from('leads').delete().in('id', deletable.map((row) => row.id));
    if (deleteError) throw deleteError;
    const snapshots = await withAssignees(deletable);
    await logItActions(req, deletable.map((row, index) => {
      const holder = snapshots[index]?.assignedToName || row.assigned_to;
      return {
        action: 'lead.delete',
        targetType: 'lead',
        targetId: row.id,
        targetLabel: leadLabel(row),
        reason,
        summary: isLeadDeliveryLocked(row)
          ? both(`Zugestellten Lead gelöscht (war bei ${holder})`, `Deleted a delivered lead (was with ${holder})`)
          : both('Lead gelöscht', 'Lead deleted'),
        before: consoleLead(snapshots[index]),
        after: null,
      };
    }));
    deletable.forEach((row) => afterLeadChange(row, null));
  }
  return { deleted: deletable.map((row) => row.id), skipped };
}

router.delete('/:id', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const reason = requireReason(req);
  const id = uuidParam(req);
  const result = await deleteLeads(req, [id], { force: req.body?.force === true, reason });
  if (!result.deleted.length) {
    const skip = result.skipped[0];
    if (skip?.code === 'not_found') throw fail(t('Lead wurde nicht gefunden.', 'Lead not found.'), 404);
    if (skip?.code === 'open_complaint') {
      throw fail(t(
        'Dieser Lead hat eine offene Reklamation. Löschen ist erst möglich, wenn ein Admin sie entschieden hat.',
        'This lead has an open complaint. It can only be deleted once an admin has decided the complaint.',
      ), 409);
    }
    throw fail(t(
      'Dieser Lead ist bereits an einen Berater zugestellt. Zum Löschen bitte „Trotzdem löschen“ bestätigen.',
      'This lead has already been delivered to an advisor. Please confirm "Delete anyway" to delete it.',
    ), 409, { code: 'delivery_locked' });
  }
  res.json({ ok: true });
}));

router.post('/bulk-delete', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const reason = requireReason(req);
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).filter((id) => isUuid(id)))];
  if (!ids.length) throw fail(t('Bitte mindestens einen Lead auswählen.', 'Please select at least one lead.'));
  if (ids.length > 100) throw fail(t('Maximal 100 Leads pro Vorgang.', 'At most 100 leads at a time.'));
  res.json(await deleteLeads(req, ids, { force: req.body?.force === true, reason }));
}));

export default router;
