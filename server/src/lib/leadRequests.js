import { supabase, supabaseConfig } from './supabase.js';
import { publicUser } from './auth.js';
import { ROLES, getUserRole } from './roles.js';
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

export const LEAD_TYPES = ['PKV', 'bAV', 'BU'];
export const REQUEST_STATUSES = ['pending', 'active', 'completed', 'rejected', 'cancelled'];
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
    notes: row.notes || null,
    replaceOnRefund: true,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at || null,
    pausedAt: row.paused_at || null,
    rejectedAt: row.rejected_at || null,
    cancelledAt: row.cancelled_at || null,
  };
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

  return {
    berater,
    request: current,
    requests: mapped,
    sentLeads,
    requestLeads,
    availableLeads: pool,
    assignedCount: sentLeads.filter((lead) => !lead.refundedAt).length,
    availableCount: pool.length,
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
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from('lead_requests')
      .insert({
        berater_id: beraterId,
        code: makeRequestCode(now),
        requested_count: count,
        lead_type: type,
        scope: packageScope,
        notes: String(notes || '').trim() || null,
        status: 'active',
        activated_at: now,
        created_by: createdBy || beraterId,
      })
      .select('*')
      .single();
    if (!error) return toPublicRequest(data, {});
    lastError = error;
    // Retry only on rare unique-code collisions.
    if (!/duplicate key|unique/i.test(String(error.message || ''))) break;
  }
  throw lastError;
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
  return updateLeadRequest(id, { status: 'cancelled' });
}

export async function updateLeadRequest(id, {
  requestedCount,
  notes,
  status,
  leadType,
  scope,
  replaceOnRefund,
} = {}) {
  requireDb();
  const current = await getRequestById(id);
  if (!current) return null;

  const patch = {};
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

  if (!Object.keys(patch).length) return withStats(current);

  const { data, error } = await supabase
    .from('lead_requests')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const refreshed = await refreshRequestStatus(data);
  return refreshed.mapped;
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
    const { count: pendingComplaints } = await supabase
      .from('lead_complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
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
      pendingRequests: 0,
      activeRequests: requests.filter((entry) => entry.status === 'active').length,
      pausedRequests: requests.filter((entry) => entry.status === 'cancelled').length,
      completedRequests: requests.filter((entry) => entry.status === 'completed').length,
      deliveredLeads: requests.reduce((sum, entry) => sum + entry.deliveredCount, 0),
      pendingComplaints: pendingComplaints || 0,
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
    || /replace_on_refund/i.test(message)
    || /refunded_at/i.test(message)
    || /reported_at/i.test(message);
}
