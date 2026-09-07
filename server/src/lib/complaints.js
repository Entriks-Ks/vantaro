import { supabase } from './supabase.js';
import { toDirectoryUser } from './users.js';
import { CONTACT_STATUSES, getLeadById, isUuid, tableMissing, toPublicLead } from './leads.js';
import {
  refreshRequestAfterRefund,
  requestTableMissing,
  sendLeadsToRequest,
  statsForRequests,
  toPublicRequest,
} from './leadRequests.js';
import { leadPurchaseCents } from './packages.js';

export const COMPLAINT_REASONS = [
  'invalid_phone',
  'wrong_person',
  'duplicate',
  'wrong_info',
  'missing_fields',
  'exclusivity',
  'tech_error',
];
export const COMPLAINT_STATUSES = ['pending', 'approved', 'partial', 'declined', 'info_needed'];
const COMPLAINT_COMMENT_MIN = 20;
const PROOF_MAX_CHARS = 1_800_000;
const PROOF_DATA_RE = /^data:(image\/(jpeg|jpg|png|webp|gif)|application\/pdf);base64,/i;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizeComplaintStatus(value) {
  if (value === 'rejected') return 'declined';
  if (value === 'refunded' || value === 'full') return 'approved';
  if (value === 'teilweise') return 'partial';
  if (value === 'infos_noetig' || value === 'info') return 'info_needed';
  return value || '';
}

function parseProof(name, data) {
  const proofName = String(name || '').trim().slice(0, 180);
  const proofData = String(data || '').trim();
  if (!proofName && !proofData) return { proofName: null, proofData: null };
  if (!proofData) return { proofName: proofName || null, proofData: null };
  if (proofData.length > PROOF_MAX_CHARS) {
    throw fail('Der Nachweis ist zu groß. Maximal etwa 1,2 MB.');
  }
  if (!PROOF_DATA_RE.test(proofData)) {
    throw fail('Nachweis bitte als PDF oder Bild (JPG, PNG, WebP) hochladen.');
  }
  return { proofName: proofName || 'nachweis', proofData };
}

function complaintSnapshot(lead, { contactStatus, notes } = {}) {
  const contact = CONTACT_STATUSES.includes(contactStatus) ? contactStatus : null;
  return {
    leadId: lead.id,
    assignedAt: lead.assigned_at || null,
    priceCents: leadPurchaseCents(toPublicLead(lead)),
    fullName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    phone: lead.phone || null,
    email: lead.email || null,
    employmentStatus: lead.employment_status || null,
    insuranceStatus: lead.insurance_status || [],
    coverageCircle: lead.coverage_circle || [],
    mainConcerns: lead.main_concerns || [],
    notes: lead.notes || null,
    brokerNotes: String(notes || lead.broker_notes || '').trim() || null,
    contactStatus: contact,
  };
}

export function toPublicComplaint(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    requestId: row.request_id || null,
    beraterId: row.berater_id,
    reason: row.reason,
    comment: row.comment || null,
    adminNote: row.admin_note || null,
    proofName: row.proof_name || null,
    proofData: row.proof_data || null,
    contactStatus: row.contact_status || row.snapshot?.contactStatus || null,
    refundCents: row.refund_cents == null ? null : Number(row.refund_cents),
    snapshot: row.snapshot || null,
    status: normalizeComplaintStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    refundedAt: row.refunded_at || null,
    replacementLeadId: row.replacement_lead_id || null,
    ...extras,
  };
}

async function loadUser(id) {
  if (!id) return null;
  const { data } = await supabase.auth.admin.getUserById(id);
  return data?.user ? toDirectoryUser(data.user) : null;
}

export async function reportLead(leadId, beraterId, {
  reason,
  comment,
  proofName,
  proofData,
  contactStatus,
  notes,
} = {}) {
  if (!isUuid(leadId)) throw fail('Lead ist ungültig.');
  if (!COMPLAINT_REASONS.includes(reason)) throw fail('Bitte einen gültigen Grund wählen.');
  const note = String(comment || '').trim();
  if (note.length < COMPLAINT_COMMENT_MIN) {
    throw fail(`Bitte die Begründung mit mindestens ${COMPLAINT_COMMENT_MIN} Zeichen beschreiben.`);
  }
  const proof = parseProof(proofName, proofData);
  const contact = CONTACT_STATUSES.includes(contactStatus) ? contactStatus : null;

  const lead = await getLeadById(leadId);
  if (!lead) throw fail('Lead wurde nicht gefunden.', 404);
  if (lead.assigned_to !== beraterId) throw fail('Sie können nur eigene Leads melden.', 403);
  if (lead.refunded_at) throw fail('Dieser Lead wurde bereits erstattet.');

  const { data: existingRows, error: existingError } = await supabase
    .from('lead_complaints')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (existingError) throw existingError;

  const open = (existingRows || []).find((row) => normalizeComplaintStatus(row.status) === 'pending');
  if (open) throw fail('Für diesen Lead liegt bereits eine Reklamation vor.');

  const amendable = (existingRows || []).find((row) => (
    normalizeComplaintStatus(row.status) === 'info_needed'
  ));

  const snapshot = complaintSnapshot(lead, { contactStatus: contact, notes });
  const payload = {
    reason,
    comment: amendable
      ? `${amendable.comment || ''}\n\n--- Ergänzung ---\n${note}`.trim()
      : note,
    proof_name: proof.proofName || amendable?.proof_name || null,
    proof_data: proof.proofData || amendable?.proof_data || null,
    contact_status: contact,
    snapshot,
    status: 'pending',
    admin_note: amendable ? amendable.admin_note : null,
    reviewed_at: null,
    reviewed_by: null,
  };

  let data;
  let error;
  if (amendable) {
    ({ data, error } = await supabase
      .from('lead_complaints')
      .update(payload)
      .eq('id', amendable.id)
      .select('*')
      .single());
  } else {
    ({ data, error } = await supabase
      .from('lead_complaints')
      .insert({
        lead_id: leadId,
        request_id: lead.request_id || null,
        berater_id: beraterId,
        ...payload,
      })
      .select('*')
      .single());
  }
  if (error) {
    const message = String(error.message || '');
    if (message.includes('lead_complaints_reason_check') || message.includes('lead_complaints_status_check') || message.includes('violates check constraint') || message.includes('proof_') || message.includes('snapshot') || message.includes('contact_status')) {
      throw fail('Reklamationen sind nicht aktuell. Bitte server/supabase/lead_workflow.sql im Supabase SQL Editor ausführen.');
    }
    throw error;
  }

  await supabase
    .from('leads')
    .update({ reported_at: new Date().toISOString() })
    .eq('id', leadId);

  return toPublicComplaint(data);
}

export async function listComplaints({ status } = {}) {
  let query = supabase.from('lead_complaints').select('*').order('created_at', { ascending: false });
  const normalized = normalizeComplaintStatus(status);
  if (normalized && COMPLAINT_STATUSES.includes(normalized)) query = query.eq('status', normalized);
  const { data, error } = await query;
  if (error) throw error;

  const rows = data || [];
  const leadIds = [...new Set(rows.map((row) => row.lead_id))];
  const replacementLeadIds = [...new Set(rows.map((row) => row.replacement_lead_id).filter(Boolean))];
  const beraterIds = [...new Set(rows.map((row) => row.berater_id))];
  const requestIds = [...new Set(rows.map((row) => row.request_id).filter(Boolean))];

  const leads = new Map();
  const allLeadIds = [...new Set([...leadIds, ...replacementLeadIds])];
  if (allLeadIds.length) {
    const { data: leadRows } = await supabase.from('leads').select('*').in('id', allLeadIds);
    for (const row of leadRows || []) leads.set(row.id, toPublicLead(row));
  }

  const beraters = new Map();
  await Promise.all(beraterIds.map(async (id) => {
    beraters.set(id, await loadUser(id));
  }));

  const requests = new Map();
  if (requestIds.length) {
    const { data: requestRows } = await supabase.from('lead_requests').select('*').in('id', requestIds);
    const stats = await statsForRequests(requestIds);
    for (const row of requestRows || []) {
      requests.set(row.id, toPublicRequest(row, stats.get(row.id)));
    }
  }

  return rows.map((row) => toPublicComplaint(row, {
    lead: leads.get(row.lead_id) || null,
    berater: beraters.get(row.berater_id) || null,
    request: requests.get(row.request_id) || null,
    replacementLead: row.replacement_lead_id ? leads.get(row.replacement_lead_id) || null : null,
  }));
}

export async function complaintsByLeadIds(leadIds) {
  const ids = [...new Set((leadIds || []).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from('lead_complaints')
    .select('*')
    .in('lead_id', ids)
    .order('created_at', { ascending: false });
  if (error) throw error;
  for (const row of data || []) {
    if (!map.has(row.lead_id)) map.set(row.lead_id, toPublicComplaint(row));
  }
  return map;
}

export async function attachComplaints(leads) {
  const list = Array.isArray(leads) ? leads : [];
  try {
    const map = await complaintsByLeadIds(list.map((lead) => lead.id));
    return list.map((lead) => ({ ...lead, complaint: map.get(lead.id) || null }));
  } catch (error) {
    if (complaintTableMissing(error)) {
      return list.map((lead) => ({ ...lead, complaint: null }));
    }
    throw error;
  }
}

export async function listComplaintsForBerater(beraterId) {
  const { data, error } = await supabase
    .from('lead_complaints')
    .select('*')
    .eq('berater_id', beraterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => toPublicComplaint(row));
}

async function moveLeadToRejected(leadId) {
  const lead = await getLeadById(leadId);
  if (!lead) throw fail('Lead wurde nicht gefunden.', 404);
  const now = new Date().toISOString();
  const nextStatus = lead.status === 'zugewiesen' ? 'in_bearbeitung' : (lead.status || 'neu');
  const { data, error } = await supabase
    .from('leads')
    .update({
      assigned_to: null,
      assigned_at: lead.assigned_at || null,
      refunded_at: now,
      status: nextStatus,
    })
    .eq('id', leadId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function reviewComplaint(id, {
  status,
  note,
  replaceLeadId,
  reviewerId,
  refundCents,
} = {}) {
  const next = normalizeComplaintStatus(status);
  if (!['approved', 'partial', 'declined', 'info_needed'].includes(next)) {
    throw fail('Status ist ungültig.');
  }

  const { data: current, error: loadError } = await supabase
    .from('lead_complaints')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!current) return null;

  const currentStatus = normalizeComplaintStatus(current.status);
  if (!['pending', 'info_needed'].includes(currentStatus)) {
    throw fail('Diese Reklamation wurde bereits entschieden.');
  }

  const now = new Date().toISOString();
  const adminNote = String(note || '').trim();
  const lead = await getLeadById(current.lead_id);
  const fullCents = leadPurchaseCents(toPublicLead(lead) || {});
  const requestedRefund = refundCents == null || refundCents === '' ? null : Math.round(Number(refundCents));

  if (next === 'declined' || next === 'info_needed') {
    if (!adminNote) {
      throw fail(next === 'info_needed'
        ? 'Bitte schreiben Sie, welche Informationen noch fehlen. Der Berater sieht diese Notiz.'
        : 'Bitte begründen Sie die Ablehnung. Der Berater sieht diese Notiz.');
    }

    const { data, error } = await supabase
      .from('lead_complaints')
      .update({
        status: next,
        admin_note: adminNote,
        reviewed_at: now,
        reviewed_by: reviewerId || null,
        refunded_at: null,
        refund_cents: null,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return { complaint: toPublicComplaint(data) };
  }

  const creditCents = next === 'partial'
    ? (Number.isFinite(requestedRefund) && requestedRefund > 0 ? Math.min(requestedRefund, fullCents) : Math.round(fullCents / 2))
    : fullCents;

  const { data: complaintRow, error } = await supabase
    .from('lead_complaints')
    .update({
      status: next,
      refunded_at: now,
      refund_cents: creditCents,
      reviewed_at: now,
      reviewed_by: reviewerId || null,
      admin_note: adminNote || null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  const rejectedLead = await moveLeadToRejected(current.lead_id);
  let request = null;
  if (current.request_id) {
    request = await refreshRequestAfterRefund(current.request_id);
  }

  let replacement = null;
  let replaceError = null;
  if (replaceLeadId) {
    try {
      if (!current.request_id) throw fail('Dieser Lead ist keinem Auftrag zugeordnet.');
      const sent = await sendLeadsToRequest(current.request_id, [replaceLeadId], {
        skipReplacementLink: true,
      });
      replacement = sent?.leads?.[0] || null;
      request = sent?.request || request;
    } catch (err) {
      replaceError = err.message || 'Ersatzlead konnte nicht gesendet werden.';
    }
  }

  let complaintRowFinal = complaintRow;
  if (replacement?.id) {
    const { data: linked, error: linkError } = await supabase
      .from('lead_complaints')
      .update({ replacement_lead_id: replacement.id })
      .eq('id', id)
      .select('*')
      .single();
    if (linkError) throw linkError;
    complaintRowFinal = linked;
  }

  return {
    complaint: toPublicComplaint(complaintRowFinal, {
      lead: toPublicLead(rejectedLead),
      request,
      replacementLead: replacement,
    }),
    request,
    replacement,
    replaceError,
  };
}

export async function linkNextReplacementComplaint(requestId, replacementLeadId) {
  if (!requestId || !replacementLeadId) return null;
  const { data: pending, error: pendingError } = await supabase
    .from('lead_complaints')
    .select('id')
    .eq('request_id', requestId)
    .eq('status', 'approved')
    .is('replacement_lead_id', null)
    .order('refunded_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendingError) throw pendingError;
  if (!pending) return null;

  const { data, error } = await supabase
    .from('lead_complaints')
    .update({ replacement_lead_id: replacementLeadId })
    .eq('id', pending.id)
    .select('*')
    .single();
  if (error) throw error;
  return toPublicComplaint(data);
}

export async function sendComplaintReplacement(id, replaceLeadId) {
  if (!isUuid(replaceLeadId)) throw fail('Bitte einen Ersatzlead wählen.');

  const { data: current, error: loadError } = await supabase
    .from('lead_complaints')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!current) return null;

  if (normalizeComplaintStatus(current.status) !== 'approved') {
    throw fail('Nur erstattete Reklamationen können einen Ersatz erhalten.');
  }
  if (current.replacement_lead_id) {
    throw fail('Für diese Reklamation wurde bereits ein Ersatzlead gesendet.');
  }
  if (!current.request_id) {
    throw fail('Dieser Lead ist keinem Auftrag zugeordnet.');
  }

  const sent = await sendLeadsToRequest(current.request_id, [replaceLeadId], {
    skipReplacementLink: true,
  });
  const replacement = sent?.leads?.[0] || null;
  if (!replacement?.id) throw fail('Ersatzlead konnte nicht gesendet werden.');

  const { data: linked, error: linkError } = await supabase
    .from('lead_complaints')
    .update({ replacement_lead_id: replacement.id })
    .eq('id', id)
    .select('*')
    .single();
  if (linkError) throw linkError;

  const rejectedLead = await getLeadById(current.lead_id);
  const berater = await loadUser(current.berater_id);

  return {
    complaint: toPublicComplaint(linked, {
      lead: rejectedLead ? toPublicLead(rejectedLead) : null,
      berater,
      request: sent?.request || null,
      replacementLead: replacement,
    }),
    replacement,
    request: sent?.request || null,
  };
}

export async function refundComplaint(id, reviewerId, { replaceLeadId } = {}) {
  return reviewComplaint(id, { status: 'approved', replaceLeadId, reviewerId });
}

export function complaintTableMissing(error) {
  const message = String(error?.message || error?.code || '');
  return tableMissing(error)
    || requestTableMissing(error)
    || /lead_complaints/i.test(message)
    || /admin_note/i.test(message)
    || /proof_name/i.test(message)
    || /proof_data/i.test(message)
    || /contact_status/i.test(message)
    || /refund_cents/i.test(message)
    || /snapshot/i.test(message)
    || /replacement_lead_id/i.test(message);
}

