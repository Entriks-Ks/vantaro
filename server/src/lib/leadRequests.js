import { supabase, supabaseConfig } from './supabase.js';
import { ROLES, getUserRole } from './roles.js';
import { listDirectoryUsers, toDirectoryUser } from './users.js';
import {
  assignLead,
  isUuid,
  listLeads,
  listMyLeads,
  tableMissing,
  withAssignees,
} from './leads.js';

export const REQUEST_STATUSES = ['angefragt', 'aktiv', 'pausiert', 'erledigt'];

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

export function toPublicRequest(row, sentCount = 0) {
  if (!row) return null;
  const requested = Number(row.requested_count) || 0;
  const sent = Number(sentCount) || 0;
  return {
    id: row.id,
    beraterId: row.berater_id,
    requestedCount: requested,
    sentCount: sent,
    remaining: Math.max(0, requested - sent),
    status: row.status,
    notes: row.notes || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at || null,
    pausedAt: row.paused_at || null,
  };
}

async function sentCountFor(requestId) {
  const { count, error } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', requestId);
  if (error) throw error;
  return count || 0;
}

async function sentCountsByRequest(ids) {
  const map = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from('leads')
    .select('request_id')
    .in('request_id', ids);
  if (error) throw error;
  for (const row of data || []) {
    map.set(row.request_id, (map.get(row.request_id) || 0) + 1);
  }
  return map;
}

async function assignedCountsByBerater(ids) {
  const map = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from('leads')
    .select('assigned_to')
    .in('assigned_to', ids);
  if (error) throw error;
  for (const row of data || []) {
    map.set(row.assigned_to, (map.get(row.assigned_to) || 0) + 1);
  }
  return map;
}

export async function getRequestById(id) {
  requireDb();
  const { data, error } = await supabase.from('lead_requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function refreshRequestStatus(row) {
  const sent = await sentCountFor(row.id);
  if (row.status !== 'pausiert' && sent >= row.requested_count && row.status !== 'erledigt') {
    const { data, error } = await supabase
      .from('lead_requests')
      .update({ status: 'erledigt' })
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) throw error;
    return { row: data, sent };
  }
  return { row, sent };
}

async function requireBerater(beraterId) {
  if (!isUuid(beraterId)) throw fail('Berater ist ungültig.');
  const { data, error } = await supabase.auth.admin.getUserById(beraterId);
  if (error || !data?.user) throw fail('Berater wurde nicht gefunden.');
  if (getUserRole(data.user) !== ROLES.BERATER) {
    throw fail('Nur Berater-Konten können Aufträge erhalten.');
  }
  return toDirectoryUser(data.user);
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

  const requestRows = requests || [];
  const counts = await sentCountsByRequest(requestRows.map((row) => row.id));
  const assigned = await assignedCountsByBerater(beraters.map((user) => user.id));

  const byBerater = new Map();
  for (const row of requestRows) {
    const list = byBerater.get(row.berater_id) || [];
    list.push(toPublicRequest(row, counts.get(row.id) || 0));
    byBerater.set(row.berater_id, list);
  }

  return beraters.map((user) => {
    const userRequests = byBerater.get(user.id) || [];
    const current = userRequests.find((entry) => entry.status === 'aktiv')
      || userRequests.find((entry) => entry.status === 'angefragt')
      || userRequests.find((entry) => entry.status === 'pausiert')
      || userRequests[0]
      || null;
    return {
      ...user,
      assignedCount: assigned.get(user.id) || 0,
      request: current,
      requests: userRequests,
    };
  });
}

export async function getBeraterPipeline(beraterId) {
  requireDb();
  const berater = await requireBerater(beraterId);

  const { data: requests, error } = await supabase
    .from('lead_requests')
    .select('*')
    .eq('berater_id', beraterId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const counts = await sentCountsByRequest((requests || []).map((row) => row.id));
  const mapped = (requests || []).map((row) => toPublicRequest(row, counts.get(row.id) || 0));
  const current = mapped.find((entry) => entry.status === 'aktiv')
    || mapped.find((entry) => entry.status === 'angefragt')
    || mapped.find((entry) => entry.status === 'pausiert')
    || mapped[0]
    || null;

  const [sentLeads, availableLeads] = await Promise.all([
    listMyLeads(beraterId),
    listLeads({ assignedTo: 'unassigned' }),
  ]);

  const pool = (availableLeads || []).filter((lead) => lead.status !== 'erledigt');

  return {
    berater,
    request: current,
    requests: mapped,
    sentLeads,
    availableLeads: pool,
    assignedCount: sentLeads.length,
    availableCount: pool.length,
  };
}

export async function createLeadRequest(beraterId, { requestedCount, notes, createdBy } = {}) {
  requireDb();
  await requireBerater(beraterId);
  const count = Number(requestedCount);
  if (!Number.isInteger(count) || count < 1) {
    throw fail('Bitte eine Anzahl größer als 0 angeben.');
  }

  const { data, error } = await supabase
    .from('lead_requests')
    .insert({
      berater_id: beraterId,
      requested_count: count,
      notes: String(notes || '').trim() || null,
      status: 'angefragt',
      created_by: createdBy || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return toPublicRequest(data, 0);
}

export async function updateLeadRequest(id, { requestedCount, notes, status } = {}) {
  requireDb();
  const current = await getRequestById(id);
  if (!current) return null;

  const patch = {};
  if (requestedCount != null) {
    const count = Number(requestedCount);
    if (!Number.isInteger(count) || count < 1) {
      throw fail('Bitte eine Anzahl größer als 0 angeben.');
    }
    const sent = await sentCountFor(id);
    if (count < sent) {
      throw fail(`Anzahl darf nicht unter den bereits gesendeten ${sent} Leads liegen.`);
    }
    patch.requested_count = count;
    if (current.status === 'erledigt' && count > sent) {
      patch.status = 'aktiv';
      patch.activated_at = new Date().toISOString();
      patch.paused_at = null;
    }
  }

  if (notes !== undefined) {
    patch.notes = String(notes || '').trim() || null;
  }

  if (status) {
    if (!REQUEST_STATUSES.includes(status)) throw fail('Status ist ungültig.');
    patch.status = status;
    if (status === 'aktiv') {
      patch.activated_at = new Date().toISOString();
      patch.paused_at = null;
    }
    if (status === 'pausiert') {
      patch.paused_at = new Date().toISOString();
    }
  }

  if (!Object.keys(patch).length) {
    const sent = await sentCountFor(id);
    return toPublicRequest(current, sent);
  }

  if (patch.status === 'aktiv') {
    await supabase
      .from('lead_requests')
      .update({
        status: 'pausiert',
        paused_at: new Date().toISOString(),
      })
      .eq('berater_id', current.berater_id)
      .eq('status', 'aktiv')
      .neq('id', id);
  }

  const { data, error } = await supabase
    .from('lead_requests')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const refreshed = await refreshRequestStatus(data);
  return toPublicRequest(refreshed.row, refreshed.sent);
}

export async function sendLeadsToRequest(requestId, leadIds) {
  requireDb();
  const current = await getRequestById(requestId);
  if (!current) return null;

  if (current.status === 'pausiert') {
    throw fail('Auftrag ist pausiert. Bitte zuerst aktivieren.');
  }
  if (current.status === 'erledigt') {
    throw fail('Auftrag ist bereits erfüllt. Erhöhen Sie zuerst die Anzahl.');
  }

  const ids = [...new Set((leadIds || []).filter((id) => isUuid(id)))];
  if (!ids.length) throw fail('Bitte mindestens einen Lead auswählen.');

  const sent = await sentCountFor(requestId);
  const remaining = Math.max(0, current.requested_count - sent);
  if (ids.length > remaining) {
    throw fail(`Nur noch ${remaining} Lead${remaining === 1 ? '' : 's'} in diesem Auftrag offen.`);
  }

  if (current.status === 'angefragt') {
    await updateLeadRequest(requestId, { status: 'aktiv' });
  }

  const assigned = [];
  for (const leadId of ids) {
    const lead = await assignLead(leadId, current.berater_id, { requestId });
    if (!lead) throw fail('Ein ausgewählter Lead wurde nicht gefunden.');
    if (lead.assignedTo !== current.berater_id) {
      throw fail('Lead konnte nicht zugewiesen werden.');
    }
    assigned.push(lead);
  }

  const row = await getRequestById(requestId);
  const refreshed = await refreshRequestStatus(row);
  return {
    request: toPublicRequest(refreshed.row, refreshed.sent),
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

  await assignLead(leadId, null);
  const row = await getRequestById(requestId);
  if (row.status === 'erledigt') {
    await supabase
      .from('lead_requests')
      .update({ status: 'aktiv', activated_at: new Date().toISOString() })
      .eq('id', requestId);
  }
  const next = await getRequestById(requestId);
  const sent = await sentCountFor(requestId);
  const [recalled] = await withAssignees([{ ...lead, assigned_to: null, request_id: null }]);
  return {
    request: toPublicRequest(next, sent),
    lead: recalled,
  };
}

export function requestTableMissing(error) {
  const message = String(error?.message || error?.code || '');
  return tableMissing(error)
    || /lead_requests/i.test(message)
    || /request_id/i.test(message);
}
