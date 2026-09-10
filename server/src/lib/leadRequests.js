import { supabase, supabaseConfig } from './supabase.js';
import { publicUser } from './auth.js';
import { getClientOrigin } from './clientOrigin.js';
import { hasCustomMailer, hasLeadsMailer, sendAdminLeadRequestEmail } from './mailer.js';
import { ROLES, adminEmails, getUserRole } from './roles.js';
import { isEmailVerified, listDirectoryUsers } from './users.js';
import {
  assignLead,
  getLeadById,
  isUuid,
  listLeads,
  listMyLeads,
  tableMissing,
  withAssignees,
} from './leads.js';
import { DEFAULT_LEAD_SCOPE, LEAD_SCOPES, leadScopeOrDefault, normalizeLeadScope } from './scopes.js';
import { beraterBusinessAddress, sortLeadsByZipProximity } from './proximity.js';

export const LEAD_TYPES = ['PKV', 'bAV', 'BU'];
export const REQUEST_STATUSES = ['pending', 'active', 'completed', 'rejected', 'cancelled'];
export const FULFILLMENT_MODES = ['manual', 'auto'];
const PENDING_STATUSES = new Set(['pending', 'angefragt', 'angefordert']);

const STATUS_ALIASES = {
  angefragt: 'active',
  angefordert: 'active',
  aktiv: 'active',
  pausiert: 'cancelled',
  erledigt: 'completed',
  pending: 'active',
  active: 'active',
  completed: 'completed',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireDb() {
  if (!supabaseConfig.configured || !supabase) {
    throw fail('Supabase ist nicht konfiguriert.', 503);
  }
}

export function normalizeRequestStatus(value) {
  return STATUS_ALIASES[String(value || '').trim()] || '';
}

export function normalizeFulfillmentMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'auto' || mode === 'automatic' || mode === 'automatisch') return 'auto';
  if (mode === 'manual' || mode === 'manuell') return 'manual';
  return '';
}

function makeRequestCode(at = new Date()) {
  const d = new Date(at);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ANF-${stamp}-${suffix}`;
}

export function toPublicRequest(row, stats = {}) {
  if (!row) return null;
  const requested = Number(row.requested_count) || 0;
  const delivered = Number(stats.deliveredCount) || 0;
  const refunded = Number(stats.refundedCount) || 0;
  const reported = Number(stats.reportedCount) || 0;
  const valid = Math.max(0, delivered - refunded);
  const remaining = Math.max(0, requested - valid);
  return {
    id: row.id,
    code: row.code || null,
    beraterId: row.berater_id,
    leadType: row.lead_type || 'PKV',
    scope: leadScopeOrDefault(row.scope),
    requestedCount: requested,
    deliveredCount: delivered,
    refundedCount: refunded,
    validCount: valid,
    reportedCount: reported,
    remaining,
    sentCount: delivered,
    status: normalizeRequestStatus(row.status) || row.status,
    fulfillmentMode: normalizeFulfillmentMode(row.fulfillment_mode) || 'manual',
    autoFilledAt: row.auto_filled_at || null,
    notes: row.notes || null,
    replaceOnRefund: true,
    adminSeenAt: row.admin_seen_at || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at || null,
    pausedAt: row.paused_at || null,
    rejectedAt: row.rejected_at || null,
    cancelledAt: row.cancelled_at || null,
  };
}

function isUnseenActiveRequest(entry) {
  return entry.status === 'active' && !entry.adminSeenAt;
}

async function listAdminNotificationEmails() {
  const emails = new Set(adminEmails());
  try {
    const directory = await listDirectoryUsers();
    for (const user of directory.users || []) {
      if (user.role === ROLES.ADMIN && user.email) {
        emails.add(String(user.email).trim().toLowerCase());
      }
    }
  } catch (error) {
    console.error('Admin email lookup failed:', error.message);
  }
  return [...emails].filter(Boolean);
}

export async function notifyAdminsOfLeadRequest(request, beraterUser = null) {
  if (!request?.id) return;
  if (!hasCustomMailer() && !hasLeadsMailer()) return;

  try {
    const recipients = await listAdminNotificationEmails();
    if (!recipients.length) return;

    let berater = beraterUser;
    if (!berater && request.beraterId) {
      const directory = await listDirectoryUsers();
      berater = (directory.users || []).find((entry) => entry.id === request.beraterId) || null;
    }

    const beraterName = berater?.fullName || berater?.email || 'Berater';
    const scopeLabel = request.scope === 'regional' ? 'Regional' : 'Exklusiv';
    const reviewUrl = `${getClientOrigin()}/dashboard/anfordern/${request.id}`;

    await sendAdminLeadRequestEmail({
      to: recipients,
      beraterName,
      beraterEmail: berater?.email || '',
      company: berater?.company || '',
      requestCode: request.code || '',
      leadType: request.leadType || 'PKV',
      scopeLabel,
      requestedCount: request.requestedCount,
      reviewUrl,
    });
  } catch (error) {
    console.error('Admin Anforderung email failed:', error.message);
  }
}

export async function statsForRequests(ids) {
  const map = new Map(ids.map((id) => [id, {
    deliveredCount: 0,
    refundedCount: 0,
    reportedCount: 0,
  }]));
  if (!ids.length) return map;

  const [{ data: leads, error: leadError }, { data: complaints, error: complaintError }] = await Promise.all([
    supabase.from('leads').select('id, request_id, refunded_at, reported_at').in('request_id', ids),
    supabase.from('lead_complaints').select('id, request_id, status').in('request_id', ids),
  ]);

  if (leadError) throw leadError;
  for (const row of leads || []) {
    const entry = map.get(row.request_id);
    if (!entry) continue;
    entry.deliveredCount += 1;
    if (row.refunded_at) entry.refundedCount += 1;
  }

  if (!complaintError) {
    for (const row of complaints || []) {
      const entry = map.get(row.request_id);
      if (!entry) continue;
      if (row.status === 'pending') entry.reportedCount += 1;
    }
  }

  return map;
}

async function withStats(row) {
  if (!row) return null;
  const map = await statsForRequests([row.id]);
  return toPublicRequest(row, map.get(row.id));
}

export async function getRequestById(id) {
  requireDb();
  const { data, error } = await supabase.from('lead_requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function activatePendingInRows(rows) {
  const pending = (rows || []).filter((row) => PENDING_STATUSES.has(row.status));
  if (!pending.length) return rows || [];
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('lead_requests')
    .update({
      status: 'active',
      activated_at: now,
    })
    .in('id', pending.map((row) => row.id));
  if (error) throw error;
  const ids = new Set(pending.map((row) => row.id));
  return (rows || []).map((row) => (
    ids.has(row.id)
      ? { ...row, status: 'active', activated_at: row.activated_at || now }
      : row
  ));
}

/** Mark fully delivered active requests as completed (and reopen if under-delivered). */
async function applyFulfillmentStatuses(rows, stats) {
  const now = new Date().toISOString();
  const completedIds = [];
  const reopenIds = [];
  const nextRows = (rows || []).map((row) => {
    const status = normalizeRequestStatus(row.status) || row.status;
    const requested = Number(row.requested_count) || 0;
    const entry = stats?.get(row.id) || {};
    const delivered = Number(entry.deliveredCount) || 0;
    const refunded = Number(entry.refundedCount) || 0;
    const valid = Math.max(0, delivered - refunded);
    if (status === 'active' && requested > 0 && valid >= requested) {
      completedIds.push(row.id);
      return { ...row, status: 'completed' };
    }
    if (status === 'completed' && valid < requested) {
      reopenIds.push(row.id);
      return { ...row, status: 'active', activated_at: row.activated_at || now };
    }
    return row;
  });

  const tasks = [];
  if (completedIds.length) {
    tasks.push(supabase.from('lead_requests').update({ status: 'completed' }).in('id', completedIds));
  }
  if (reopenIds.length) {
    tasks.push(
      supabase
        .from('lead_requests')
        .update({ status: 'active', activated_at: now, paused_at: null })
        .in('id', reopenIds),
    );
  }
  if (tasks.length) {
    const results = await Promise.all(tasks);
    for (const { error } of results) {
      if (error) throw error;
    }
  }
  return nextRows;
}

async function hydrateRequestRows(rows) {
  const activated = await activatePendingInRows(rows || []);
  if (!activated.length) return { rows: [], stats: new Map() };
  const stats = await statsForRequests(activated.map((row) => row.id));
  const synced = await applyFulfillmentStatuses(activated, stats);
  return { rows: synced, stats };
}

async function refreshRequestStatus(row) {
  const { rows } = await hydrateRequestRows(row ? [row] : []);
  const current = rows[0];
  if (!current) return { row, mapped: null };
  const mapped = await withStats(current);
  return { row: current, mapped };
}

async function requireBerater(beraterId) {
  if (!isUuid(beraterId)) throw fail('Berater ist ungültig.');
  const { data, error } = await supabase.auth.admin.getUserById(beraterId);
  if (error || !data?.user) throw fail('Berater wurde nicht gefunden.');
  if (getUserRole(data.user) !== ROLES.BERATER) {
    throw fail('Nur Berater-Konten können Aufträge erhalten.');
  }
  const mapped = publicUser(data.user);
  return {
    ...mapped,
    company: mapped.profile?.company || '',
    verified: isEmailVerified(data.user),
    createdAt: data.user.created_at || null,
  };
}

export function pickInboxRequest(requests) {
  return requests.find((entry) => entry.status === 'active')
    || requests.find((entry) => entry.status === 'cancelled')
    || requests.find((entry) => entry.status === 'completed')
    || requests[0]
    || null;
}

export function pickWorkingRequest(requests) {
  return requests.find((entry) => entry.status === 'active')
    || requests.find((entry) => entry.status === 'cancelled')
    || requests[0]
    || null;
}

export async function listBeraterPipelines() {
  requireDb();
  const directory = await listDirectoryUsers();
  const beraters = directory.users.filter((user) => user.role === ROLES.BERATER);

  const { data: requests, error } = await supabase
    .from('lead_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const { rows: requestRows, stats } = await hydrateRequestRows(requests || []);
  const assigned = await assignedCountsByBerater(beraters.map((user) => user.id));

  const byBerater = new Map();
  for (const row of requestRows) {
    const list = byBerater.get(row.berater_id) || [];
    list.push(toPublicRequest(row, stats.get(row.id)));
    byBerater.set(row.berater_id, list);
  }

  return beraters.map((user) => {
    const userRequests = byBerater.get(user.id) || [];
    return {
      ...user,
      assignedCount: assigned.get(user.id) || 0,
      request: pickInboxRequest(userRequests),
      requests: userRequests,
    };
  });
}

async function assignedCountsByBerater(ids) {
  const map = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from('leads')
    .select('assigned_to')
    .in('assigned_to', ids)
    .is('refunded_at', null);
  if (error) throw error;
  for (const row of data || []) {
    map.set(row.assigned_to, (map.get(row.assigned_to) || 0) + 1);
  }
  return map;
}

export async function getBeraterPipeline(beraterId) {
  requireDb();
  const berater = await requireBerater(beraterId);
  const mapped = await listRequestsForBerater(beraterId);
  const current = pickInboxRequest(mapped);
  const requestIds = mapped.map((entry) => entry.id);

  const [sentLeads, availableLeads, requestLeads] = await Promise.all([
    listMyLeads(beraterId),
    listLeads({ assignedTo: 'unassigned' }),
    requestIds.length ? listLeadsForRequests(requestIds) : Promise.resolve([]),
  ]);

  const pool = (availableLeads || []).filter((lead) => lead.status !== 'erledigt' && !lead.refundedAt);
  let freePool = pool;
  try {
    const { openComplaintLeadIds, complaintTableMissing } = await import('./complaints.js');
    const blocked = await openComplaintLeadIds(pool.map((lead) => lead.id));
    if (blocked.size) {
      freePool = pool.filter((lead) => !blocked.has(lead.id));
    }
  } catch (err) {
    try {
      const { complaintTableMissing } = await import('./complaints.js');
      if (!complaintTableMissing(err)) throw err;
    } catch (inner) {
      if (!String(inner?.message || '').includes('complaint')) {
        /* keep full pool if complaint table missing */
      }
    }
  }

  return {
    berater,
    request: current,
    requests: mapped,
    sentLeads,
    requestLeads,
    availableLeads: freePool,
    assignedCount: sentLeads.filter((lead) => !lead.refundedAt).length,
    availableCount: freePool.length,
  };
}

export async function listLeadsForRequest(requestId) {
  const rows = await listLeadsForRequests([requestId]);
  return rows;
}

async function listLeadsForRequests(requestIds) {
  requireDb();
  const ids = [...new Set((requestIds || []).filter((id) => isUuid(id)))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .in('request_id', ids)
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return withAssignees(data || []);
}

export async function listRequestsForBerater(beraterId) {
  requireDb();
  const { data: requests, error } = await supabase
    .from('lead_requests')
    .select('*')
    .eq('berater_id', beraterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const { rows: requestRows, stats } = await hydrateRequestRows(requests || []);
  return requestRows.map((row) => toPublicRequest(row, stats.get(row.id)));
}

export async function listAllRequests() {
  requireDb();
  const directory = await listDirectoryUsers();
  const users = new Map(directory.users.map((user) => [user.id, user]));
  const { data: requests, error } = await supabase
    .from('lead_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const { rows: requestRows, stats } = await hydrateRequestRows(requests || []);
  return requestRows.map((row) => ({
    ...toPublicRequest(row, stats.get(row.id)),
    berater: users.get(row.berater_id) || null,
  }));
}

export async function createLeadRequest(beraterId, {
  requestedCount,
  notes,
  leadType = 'PKV',
  scope = DEFAULT_LEAD_SCOPE,
  createdBy,
  notifyAdmins = true,
} = {}) {
  requireDb();
  await requireBerater(beraterId);
  const count = Number(requestedCount);
  if (!Number.isInteger(count) || count < 1) {
    throw fail('Bitte eine Anzahl größer als 0 angeben.');
  }
  const type = String(leadType || 'PKV').trim();
  if (!LEAD_TYPES.includes(type)) throw fail('Lead-Typ ist ungültig.');
  const packageScope = normalizeLeadScope(scope) || DEFAULT_LEAD_SCOPE;
  if (!LEAD_SCOPES.includes(packageScope)) throw fail('Paket muss deutschlandweit oder regional sein.');

  const now = new Date().toISOString();
  const seenAtCreate = notifyAdmins ? null : now;
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const insertRow = {
      berater_id: beraterId,
      code: makeRequestCode(now),
      requested_count: count,
      lead_type: type,
      scope: packageScope,
      notes: String(notes || '').trim() || null,
      status: 'active',
      fulfillment_mode: 'manual',
      activated_at: now,
      created_by: createdBy || beraterId,
    };
    if (seenAtCreate) insertRow.admin_seen_at = seenAtCreate;

    const { data, error } = await supabase
      .from('lead_requests')
      .insert(insertRow)
      .select('*')
      .single();
    if (!error) {
      const request = toPublicRequest(data, {});
      if (notifyAdmins) {
        // Fire-and-forget — never block Anforderung creation on email delivery.
        notifyAdminsOfLeadRequest(request).catch((mailError) => {
          console.error('Admin Anforderung email failed:', mailError.message);
        });
      }
      return request;
    }
    lastError = error;
    if (fulfillmentModeColumnMissing(error) && insertRow.fulfillment_mode) {
      delete insertRow.fulfillment_mode;
      const retry = await supabase
        .from('lead_requests')
        .insert(insertRow)
        .select('*')
        .single();
      if (!retry.error) {
        const request = toPublicRequest(retry.data, {});
        if (notifyAdmins) {
          notifyAdminsOfLeadRequest(request).catch((mailError) => {
            console.error('Admin Anforderung email failed:', mailError.message);
          });
        }
        return request;
      }
      lastError = retry.error;
    }
    // Retry only on rare unique-code collisions.
    if (!/duplicate key|unique/i.test(String(error.message || ''))) break;
  }
  throw lastError;
}

export async function markRequestSeen(id) {
  requireDb();
  if (!isUuid(id)) return null;
  const current = await getRequestById(id);
  if (!current) return null;
  if (current.admin_seen_at) {
    return withStats(current);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('lead_requests')
    .update({ admin_seen_at: now })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return withStats(data);
}

export async function cancelOwnRequest(id, beraterId) {
  requireDb();
  const current = await getRequestById(id);
  if (!current) return null;
  if (current.berater_id !== beraterId) throw fail('Keine Berechtigung.', 403);
  const status = normalizeRequestStatus(current.status);
  if (status !== 'active' && status !== 'cancelled') {
    throw fail('Nur aktive oder pausierte Anforderungen können storniert werden.');
  }
  const result = await updateLeadRequest(id, { status: 'cancelled' });
  return result?.request || null;
}

export async function updateLeadRequest(id, {
  requestedCount,
  notes,
  status,
  leadType,
  scope,
  replaceOnRefund,
  fulfillmentMode,
} = {}) {
  requireDb();
  const current = await getRequestById(id);
  if (!current) return null;

  const patch = {};
  let switchedToAuto = false;
  if (requestedCount != null) {
    const count = Number(requestedCount);
    if (!Number.isInteger(count) || count < 1) {
      throw fail('Bitte eine Anzahl größer als 0 angeben.');
    }
    const mapped = await withStats(current);
    if (count < mapped.validCount) {
      throw fail(`Anzahl darf nicht unter den ${mapped.validCount} gültigen Leads liegen.`);
    }
    patch.requested_count = count;
    if (current.status === 'completed' && count > mapped.validCount) {
      patch.status = 'active';
      patch.activated_at = new Date().toISOString();
    }
  }

  if (notes !== undefined) patch.notes = String(notes || '').trim() || null;

  if (leadType) {
    if (!LEAD_TYPES.includes(leadType)) throw fail('Lead-Typ ist ungültig.');
    patch.lead_type = leadType;
  }

  if (scope) {
    const packageScope = normalizeLeadScope(scope);
    if (!LEAD_SCOPES.includes(packageScope)) throw fail('Paket muss deutschlandweit oder regional sein.');
    patch.scope = packageScope;
  }

  if (typeof replaceOnRefund === 'boolean') {
    patch.replace_on_refund = replaceOnRefund;
  }

  if (fulfillmentMode !== undefined) {
    const mode = normalizeFulfillmentMode(fulfillmentMode);
    if (!FULFILLMENT_MODES.includes(mode)) {
      throw fail('Belieferungsmodus muss manuell oder automatisch sein.');
    }
    const previous = normalizeFulfillmentMode(current.fulfillment_mode) || 'manual';
    patch.fulfillment_mode = mode;
    switchedToAuto = mode === 'auto' && previous !== 'auto';
  }

  if (status) {
    const next = normalizeRequestStatus(status);
    if (!REQUEST_STATUSES.includes(next)) throw fail('Status ist ungültig.');
    patch.status = next;
    if (next === 'active') {
      patch.activated_at = new Date().toISOString();
      patch.paused_at = null;
      patch.rejected_at = null;
      patch.cancelled_at = null;
    }
    if (next === 'rejected') patch.rejected_at = new Date().toISOString();
    if (next === 'cancelled') {
      patch.cancelled_at = new Date().toISOString();
      patch.paused_at = new Date().toISOString();
    }
  }

  if (!Object.keys(patch).length) {
    return { request: await withStats(current), autoFill: null };
  }

  const { data, error } = await supabase
    .from('lead_requests')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (fulfillmentModeColumnMissing(error)) {
      throw fail(
        'Belieferungsmodus fehlt in der Datenbank. Bitte server/supabase/lead_request_fulfillment_mode.sql ausführen.',
        503,
      );
    }
    throw error;
  }
  const refreshed = await refreshRequestStatus(data);
  let mapped = refreshed.mapped;
  let autoFill = null;

  const shouldAutoFill = mapped?.status === 'active'
    && mapped.remaining > 0
    && (
      switchedToAuto
      || (
        (normalizeFulfillmentMode(mapped.fulfillmentMode) || 'manual') === 'auto'
        && patch.status === 'active'
      )
    );

  if (shouldAutoFill) {
    try {
      // Immediate partial send — does not wait for the full requested count.
      autoFill = await autoFillRequest(id);
      mapped = autoFill.request || mapped;
    } catch (err) {
      console.warn('Auto-fill after request update skipped:', err.message);
    }
  }

  return { request: mapped, autoFill };
}

export function fulfillmentModeColumnMissing(error) {
  const message = String(error?.message || error?.code || '');
  return /fulfillment_mode|auto_filled_at/i.test(message)
    && (/column/i.test(message) || /schema cache/i.test(message) || error?.code === 'PGRST204');
}

/**
 * Pick nearest matching unassigned leads for an active request and assign them
 * immediately (partial OK — does not wait until remaining === requested).
 * Uses the same pool rules as manual send (scope, not refunded, no open complaint).
 */
export async function autoFillRequest(requestId) {
  requireDb();
  const current = await getRequestById(requestId);
  if (!current) return null;
  const mapped = await withStats(current);

  if (mapped.status === 'cancelled' || mapped.status === 'rejected') {
    throw fail('Dieser Auftrag ist nicht aktiv.');
  }
  if (mapped.status === 'completed' || mapped.remaining <= 0) {
    return {
      request: mapped,
      leads: [],
      selectedCount: 0,
      availableCount: 0,
      sorted: false,
      mode: null,
      message: 'Keine offenen Plätze mehr.',
    };
  }

  const pipeline = await getBeraterPipeline(current.berater_id);
  const requestScope = leadScopeOrDefault(current.scope);
  const scoped = (pipeline.availableLeads || []).filter(
    (lead) => leadScopeOrDefault(lead.scope) === requestScope
      && lead.status !== 'erledigt'
      && !lead.refundedAt,
  );

  const origin = beraterBusinessAddress(pipeline.berater);
  const { leads: ordered, sorted, mode } = sortLeadsByZipProximity(scoped, origin);
  const pick = ordered.slice(0, mapped.remaining);
  const leadIds = pick.map((lead) => lead.id).filter(Boolean);

  if (!leadIds.length) {
    return {
      request: mapped,
      leads: [],
      selectedCount: 0,
      availableCount: scoped.length,
      sorted,
      mode,
      origin,
      message: 'Kein passender Lead im Pool.',
    };
  }

  const result = await sendLeadsToRequest(requestId, leadIds);
  const now = new Date().toISOString();
  try {
    await supabase
      .from('lead_requests')
      .update({ auto_filled_at: now })
      .eq('id', requestId);
  } catch (err) {
    console.warn('auto_filled_at update skipped:', err.message);
  }

  const row = await getRequestById(requestId);
  const refreshed = await refreshRequestStatus(row);
  return {
    request: refreshed.mapped || result.request,
    leads: result.leads || [],
    selectedCount: (result.leads || []).length,
    availableCount: scoped.length,
    sorted,
    mode,
    origin,
    message: `${(result.leads || []).length} Lead${(result.leads || []).length === 1 ? '' : 's'} automatisch zugestellt.`,
  };
}

/** Best-effort fill for all active auto requests (e.g. after new leads arrive). */
export async function autoFillOpenAutoRequests({ limit = 40 } = {}) {
  requireDb();
  const { data, error } = await supabase
    .from('lead_requests')
    .select('*')
    .eq('status', 'active')
    .eq('fulfillment_mode', 'auto')
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(Number(limit) || 40, 80)));

  if (error) {
    if (fulfillmentModeColumnMissing(error)) return [];
    throw error;
  }

  const results = [];
  for (const row of data || []) {
    try {
      const mapped = await withStats(row);
      if (!mapped.remaining) continue;
      const fill = await autoFillRequest(row.id);
      if (fill?.selectedCount) results.push(fill);
    } catch (err) {
      console.warn(`Auto-fill for ${row.id} skipped:`, err.message);
    }
  }
  return results;
}

export async function sendLeadsToRequest(requestId, leadIds, { skipReplacementLink = false } = {}) {
  requireDb();
  const current = await getRequestById(requestId);
  if (!current) return null;
  const mapped = await withStats(current);

  if (mapped.status === 'cancelled' || mapped.status === 'rejected') {
    throw fail('Dieser Auftrag ist nicht aktiv.');
  }
  if (mapped.status === 'completed') {
    throw fail('Auftrag ist bereits erfüllt. Erhöhen Sie zuerst die Anzahl.');
  }

  const ids = [...new Set((leadIds || []).filter((id) => isUuid(id)))];
  if (!ids.length) throw fail('Bitte mindestens einen Lead auswählen.');
  if (ids.length > mapped.remaining) {
    throw fail(`Nur noch ${mapped.remaining} Lead${mapped.remaining === 1 ? '' : 's'} in diesem Auftrag offen.`);
  }

  const assigned = [];
  const requestScope = leadScopeOrDefault(current.scope);
  for (const leadId of ids) {
    const currentLead = await getLeadById(leadId);
    if (!currentLead) throw fail('Ein ausgewählter Lead wurde nicht gefunden.');
    if (leadScopeOrDefault(currentLead.scope) !== requestScope) {
      throw fail(`Dieser Auftrag ist ${requestScope === 'regional' ? 'regional' : 'deutschlandweit'}. Bitte nur passende Leads senden.`);
    }
    const lead = await assignLead(leadId, current.berater_id, { requestId });
    if (!lead) throw fail('Ein ausgewählter Lead wurde nicht gefunden.');
    if (lead.assignedTo !== current.berater_id) {
      throw fail('Lead konnte nicht zugewiesen werden.');
    }
    assigned.push(lead);
    if (!skipReplacementLink) {
      try {
        const { linkNextReplacementComplaint, complaintTableMissing } = await import('./complaints.js');
        await linkNextReplacementComplaint(requestId, lead.id);
      } catch (err) {
        try {
          const { complaintTableMissing } = await import('./complaints.js');
          if (!complaintTableMissing(err)) {
            console.warn('Replacement complaint link skipped:', err.message);
          }
        } catch {
          console.warn('Replacement complaint link skipped:', err?.message || err);
        }
      }
    }
  }

  const row = await getRequestById(requestId);
  const refreshed = await refreshRequestStatus(row);
  return {
    request: refreshed.mapped,
    leads: assigned,
  };
}

export async function recallLeadFromRequest(requestId, leadId) {
  requireDb();
  const current = await getRequestById(requestId);
  if (!current) return null;
  if (!isUuid(leadId)) throw fail('Lead ist ungültig.');

  const { data: lead, error } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (error) throw error;
  if (!lead || lead.request_id !== requestId) {
    throw fail('Dieser Lead gehört nicht zu diesem Auftrag.');
  }
  if (lead.refunded_at) throw fail('Erstattete Leads können nicht zurückgenommen werden.');
  if (lead.assigned_to) {
    throw fail('Zugestellte Leads können nicht manuell zurückgenommen werden. Rückgabe nur über eine Reklamation.');
  }

  await assignLead(leadId, null);
  const row = await getRequestById(requestId);
  const refreshed = await refreshRequestStatus(row);
  return {
    request: refreshed.mapped,
    lead: null,
  };
}

export async function countWorkflowStats() {
  if (!supabaseConfig.configured || !supabase) {
    return emptyWorkflowStats();
  }
  try {
    const requests = await listAllRequests();
    const { count: pendingComplaints, error: pendingError } = await supabase
      .from('lead_complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (pendingError) throw pendingError;

    let unseenComplaints = pendingComplaints || 0;
    const unseenPending = await supabase
      .from('lead_complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .is('admin_seen_at', null);
    if (unseenPending.error) {
      const message = String(unseenPending.error.message || '');
      if (!(/column .*admin_seen_at/i.test(message) || /admin_seen_at/i.test(message))) {
        throw unseenPending.error;
      }
      // Column missing: fall back to all pending for the sidebar badge.
    } else {
      unseenComplaints = unseenPending.count || 0;
    }
    const { count: approvedComplaints } = await supabase
      .from('lead_complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    const { count: declinedComplaints } = await supabase
      .from('lead_complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'declined');
    const { count: refundedLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('refunded_at', 'is', null);

    return {
      pendingRequests: requests.filter(isUnseenActiveRequest).length,
      activeRequests: requests.filter((entry) => entry.status === 'active').length,
      pausedRequests: requests.filter((entry) => entry.status === 'cancelled').length,
      completedRequests: requests.filter((entry) => entry.status === 'completed').length,
      deliveredLeads: requests.reduce((sum, entry) => sum + entry.deliveredCount, 0),
      pendingComplaints: pendingComplaints || 0,
      unseenComplaints,
      approvedComplaints: approvedComplaints || 0,
      declinedComplaints: declinedComplaints || 0,
      refundedLeads: refundedLeads || 0,
      recentRequests: requests.slice(0, 6),
    };
  } catch (error) {
    if (tableMissing(error) || requestTableMissing(error)) return emptyWorkflowStats();
    throw error;
  }
}

function emptyWorkflowStats() {
  return {
    pendingRequests: 0,
    activeRequests: 0,
    pausedRequests: 0,
    completedRequests: 0,
    deliveredLeads: 0,
    pendingComplaints: 0,
    unseenComplaints: 0,
    approvedComplaints: 0,
    declinedComplaints: 0,
    refundedLeads: 0,
    recentRequests: [],
  };
}

export async function refreshRequestAfterRefund(id) {
  const row = await getRequestById(id);
  if (!row) return null;
  const refreshed = await refreshRequestStatus(row);
  return refreshed.mapped;
}

export function requestTableMissing(error) {
  const message = String(error?.message || error?.code || '');
  return tableMissing(error)
    || /lead_requests/i.test(message)
    || /lead_complaints/i.test(message)
    || /request_id/i.test(message)
    || /lead_type/i.test(message)
    || /column .*scope/i.test(message)
    || /column .*code/i.test(message)
    || /column .*admin_seen_at/i.test(message)
    || /admin_seen_at/i.test(message)
    || /replace_on_refund/i.test(message)
    || /refunded_at/i.test(message)
    || /reported_at/i.test(message);
}
