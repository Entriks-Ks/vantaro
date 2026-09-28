import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { supabase } from './supabase.js';
import { publicUser, normalizeEnergyPages } from './auth.js';
import { getApiOrigin, getClientOrigin } from './clientOrigin.js';
import { hasCustomMailer } from './mailer.js';
import { ROLES } from './roles.js';
import { energyLeadTypeOf, verticalOrInsurance } from './vertical.js';

const PARTNER_ROLES = ['dispatcher', 'sub_partner', 'field_rep'];
const FIELD_OUTCOMES = ['CONFIRMED', 'COMPLETED', 'NO_SHOW', 'FOLLOW_UP'];
const COMPANY_OUTCOMES = ['CANCELLED', 'RESCHEDULE_REQUESTED'];
const COMPLAINT_REASONS = ['invalid_phone', 'wrong_territory', 'customer_unaware', 'duplicate', 'appointment_not_attended'];
const BILLING_MODELS = ['PREPAID', 'MONTHLY', 'THRESHOLD', 'CUSTOM'];
const PRICE_FIELDS = {
  PV_LEAD: 'price_pv_lead',
  PV_APPOINTMENT: 'price_pv_appointment',
  HP_LEAD: 'price_hp_lead',
  HP_APPOINTMENT: 'price_hp_appointment',
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function schemaMissing(error) {
  const message = String(error?.message || error?.code || '');
  return /energy_holder_id|energy_status|energy_billing|energy_delivery|energy_complaints|energy_calendar/i.test(message)
    && (/column|relation|schema cache/i.test(message) || error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST204' || error?.code === '42703');
}

export function energySchemaError() {
  return fail('Energie-Betrieb fehlt. Bitte server/supabase/energy_portal.sql im Supabase SQL Editor ausführen.', 503);
}

function secretKey() {
  return createHash('sha256').update(process.env.SUPABASE_SERVICE_ROLE_KEY || 'vantaro-energy').digest();
}

function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decryptSecret(payload) {
  const raw = Buffer.from(String(payload || ''), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

export function energyCompanyId(user) {
  if (user?.energyCompanyId) return user.energyCompanyId;
  if (user?.vertical === 'energy' && (user.energyRole === 'main' || !user.energyRole)) return user.id;
  return null;
}

export function canReadEnergyLead(user, row) {
  if (verticalOrInsurance(row?.vertical) !== 'energy') return false;
  const role = user?.energyRole || 'main';
  if (role === 'sub_partner' || role === 'field_rep') return row.energy_holder_id === user.id;
  return row.assigned_to === energyCompanyId(user);
}

export async function listVisibleEnergyLeads(user) {
  const role = user?.energyRole || 'main';
  let query = supabase.from('leads').select('*').eq('vertical', 'energy').is('refunded_at', null);
  if (role === 'sub_partner' || role === 'field_rep') query = query.eq('energy_holder_id', user.id);
  else query = query.eq('assigned_to', energyCompanyId(user));
  if (role === 'field_rep') query = query.eq('delivery_type', 'appointment');
  const { data, error } = await query.order('assigned_at', { ascending: false });
  if (error) {
    if (schemaMissing(error)) throw energySchemaError();
    throw error;
  }
  const { withAssignees } = await import('./leads.js');
  return withAssignees(data || []);
}

async function loadUser(id) {
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data?.user) return null;
  return data.user;
}

export async function listEnergyPartners(actor) {
  if (!['main', 'dispatcher'].includes(actor.energyRole || 'main') && actor.role !== 'admin') {
    throw fail('Keine Berechtigung.', 403);
  }
  const companyId = energyCompanyId(actor);
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...(data.users || []));
    if ((data.users || []).length < 200) break;
  }
  return users
    .filter((raw) => {
      const user = publicUser(raw);
      return user?.vertical === 'energy' && user.energyCompanyId === companyId && user.id !== companyId;
    })
    .map((raw) => {
      const user = publicUser(raw);
      const metadata = raw.user_metadata || {};
      const accepted = metadata.energy_invite_accepted === true || Boolean(raw.last_sign_in_at);
      return {
        id: user.id,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        energyRole: user.energyRole,
        active: user.energyActive !== false,
        pages: user.energyPages || normalizeEnergyPages(metadata.energy_pages),
        inviteStatus: accepted ? 'accepted' : 'pending',
        lastSignInAt: raw.last_sign_in_at || null,
        createdAt: raw.created_at || null,
      };
    })
    .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || ''), 'de'));
}

function generatePassword() {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@$%#?&*'];
  const all = sets.join('');
  const chars = sets.map((set) => set[randomInt(set.length)]);
  while (chars.length < 14) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export async function createEnergyPartner(actor, { firstName, lastName, email, energyRole, pages }) {
  if ((actor.energyRole || 'main') !== 'main') throw fail('Nur die Hauptfirma kann Unterpartner anlegen.', 403);
  const role = String(energyRole || '').trim();
  if (!PARTNER_ROLES.includes(role)) throw fail('Rolle ist ungültig.');
  const given = String(firstName || '').trim();
  const family = String(lastName || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  if (given.length < 2 || family.length < 2) throw fail('Vor- und Nachname müssen mindestens 2 Zeichen haben.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw fail('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
  const password = generatePassword();
  const pageAccess = normalizeEnergyPages(pages);
  const { data, error } = await supabase.auth.admin.createUser({
    email: mail,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: given,
      last_name: family,
      full_name: `${given} ${family}`,
      email_verified: true,
      onboarding_complete: false,
      vertical: 'energy',
      vertical_required: false,
      energy_role: role,
      energy_company_id: energyCompanyId(actor),
      energy_active: true,
      energy_pages: pageAccess,
      energy_invite_accepted: false,
    },
    app_metadata: { role: ROLES.BERATER },
  });
  if (error) throw fail(error.message || 'Zugang konnte nicht angelegt werden.');
  return {
    user: {
      id: data.user.id,
      fullName: `${given} ${family}`,
      email: mail,
      energyRole: role,
      active: true,
      pages: pageAccess,
      inviteStatus: 'pending',
    },
    password,
  };
}

export async function updateEnergyPartner(actor, partnerId, { active, pages, energyRole } = {}) {
  if ((actor.energyRole || 'main') !== 'main' && actor.role !== 'admin') {
    throw fail('Nur die Hauptfirma kann Unterpartner verwalten.', 403);
  }
  if (!partnerId) throw fail('Unterpartner wurde nicht gefunden.', 404);
  const companyId = energyCompanyId(actor);
  const raw = await loadUser(partnerId);
  if (!raw) throw fail('Unterpartner wurde nicht gefunden.', 404);
  const mapped = publicUser(raw);
  if (mapped.vertical !== 'energy' || mapped.energyCompanyId !== companyId || mapped.id === companyId) {
    throw fail('Dieser Zugang gehört nicht zur Hauptfirma.');
  }
  if (!PARTNER_ROLES.includes(mapped.energyRole)) throw fail('Dieser Zugang kann nicht bearbeitet werden.');

  const metadata = { ...(raw.user_metadata || {}) };
  if (energyRole != null) {
    const role = String(energyRole || '').trim();
    if (!PARTNER_ROLES.includes(role)) throw fail('Rolle ist ungültig.');
    metadata.energy_role = role;
  }
  if (pages != null) {
    metadata.energy_pages = normalizeEnergyPages(pages);
  }
  if (active != null) {
    metadata.energy_active = active === true;
  }

  const patch = { user_metadata: metadata };
  if (active === true) patch.ban_duration = 'none';
  if (active === false) patch.ban_duration = '876600h';

  const { data, error } = await supabase.auth.admin.updateUserById(partnerId, patch);
  if (error) throw fail(error.message || 'Unterpartner konnte nicht aktualisiert werden.');
  const next = publicUser(data.user);
  const accepted = data.user.user_metadata?.energy_invite_accepted === true || Boolean(data.user.last_sign_in_at);
  return {
    id: next.id,
    fullName: next.fullName,
    firstName: next.firstName,
    lastName: next.lastName,
    email: next.email,
    energyRole: next.energyRole,
    active: next.energyActive !== false,
    pages: next.energyPages || normalizeEnergyPages(data.user.user_metadata?.energy_pages),
    inviteStatus: accepted ? 'accepted' : 'pending',
    lastSignInAt: data.user.last_sign_in_at || null,
    createdAt: data.user.created_at || null,
  };
}

async function assertCompanyLead(actor, lead) {
  if (!lead || verticalOrInsurance(lead.vertical) !== 'energy') throw fail('Lead wurde nicht gefunden.', 404);
  if (actor.role === 'admin') return lead;
  if (!canReadEnergyLead(actor, lead)) throw fail('Keine Berechtigung.', 403);
  return lead;
}

export async function assignEnergyHolder(actor, leadId, holderId) {
  if (!['main', 'dispatcher'].includes(actor.energyRole || 'main') && actor.role !== 'admin') {
    throw fail('Nur Hauptfirma oder Dispatcher können zuweisen.', 403);
  }
  const { getLeadById, withAssignee } = await import('./leads.js');
  const lead = await assertCompanyLead(actor, await getLeadById(leadId));
  const holder = await loadUser(holderId);
  if (!holder) throw fail('Unterpartner wurde nicht gefunden.');
  const mapped = publicUser(holder);
  if (mapped.vertical !== 'energy' || mapped.energyCompanyId !== lead.assigned_to) {
    throw fail('Dieser Zugang gehört nicht zur Hauptfirma.');
  }
  if (!PARTNER_ROLES.includes(mapped.energyRole)) throw fail('Dieser Zugang kann keine Leads erhalten.');
  const nextStatus = mapped.energyRole === 'field_rep' && lead.delivery_type === 'appointment'
    ? 'CALENDAR_PENDING'
    : 'ASSIGNED';
  const { data, error } = await supabase
    .from('leads')
    .update({ energy_holder_id: holderId, energy_status: nextStatus })
    .eq('id', leadId)
    .select('*')
    .single();
  if (error) {
    if (schemaMissing(error)) throw energySchemaError();
    throw error;
  }
  if (mapped.energyRole === 'field_rep' && data.delivery_type === 'appointment') {
    await syncGoogleEvent(data, holderId, 'insert').catch((err) => {
      console.error('Energy calendar sync failed:', err.message);
    });
  }
  notifyEnergyAssignment(mapped, data).catch(() => {});
  return withAssignee(data);
}

export async function setEnergyOutcome(actor, leadId, { status, appointmentAt } = {}) {
  const { getLeadById, withAssignee } = await import('./leads.js');
  const current = await assertCompanyLead(actor, await getLeadById(leadId));
  const role = actor.energyRole || 'main';
  const next = String(status || '').trim();
  const allowed = role === 'field_rep' || role === 'sub_partner'
    ? FIELD_OUTCOMES
    : [...FIELD_OUTCOMES, ...COMPANY_OUTCOMES];
  if ((role === 'field_rep' || role === 'sub_partner') && current.energy_holder_id !== actor.id) {
    throw fail('Keine Berechtigung.', 403);
  }
  if (!allowed.includes(next)) throw fail('Status ist ungültig.');
  const patch = { energy_status: appointmentAt ? 'RESCHEDULED' : next };
  if (appointmentAt) {
    const when = new Date(appointmentAt);
    if (Number.isNaN(when.getTime())) throw fail('Termin ist ungültig.');
    patch.appointment_at = when.toISOString();
  }
  const { data, error } = await supabase.from('leads').update(patch).eq('id', leadId).select('*').single();
  if (error) {
    if (schemaMissing(error)) throw energySchemaError();
    throw error;
  }
  if (data.delivery_type === 'appointment' && data.energy_holder_id) {
    const mode = next === 'CANCELLED' ? 'delete' : (data.google_event_id ? 'update' : 'insert');
    await syncGoogleEvent(data, data.energy_holder_id, mode).catch((err) => {
      console.error('Energy calendar sync failed:', err.message);
    });
  }
  return withAssignee(data);
}

function priceFor(profile, productType) {
  if (!profile) return null;
  const value = profile?.[PRICE_FIELDS[productType]];
  return value == null || value === '' ? null : Number(value);
}

export async function recordEnergyDelivery(row) {
  if (verticalOrInsurance(row?.vertical) !== 'energy' || !row.assigned_to) return null;
  const productType = energyLeadTypeOf(row);
  if (!productType) return null;
  const profile = await getBillingProfile(row.assigned_to);
  const isAppointment = row.delivery_type === 'appointment'
    || productType === 'PV_APPOINTMENT'
    || productType === 'HP_APPOINTMENT';

  const { error: statusError } = await supabase
    .from('leads')
    .update({ energy_status: 'ASSIGNED' })
    .eq('id', row.id)
    .is('energy_status', null);
  if (statusError && !schemaMissing(statusError)) console.error('Energy status skipped:', statusError.message);

  // Seed berater pipeline only when unset — Termine landen in Termin, Leads in Neu
  if (row.contact_status == null) {
    const { error: contactError } = await supabase
      .from('leads')
      .update({ contact_status: isAppointment ? 'termin' : 'neu' })
      .eq('id', row.id)
      .is('contact_status', null);
    if (contactError && !schemaMissing(contactError)) {
      console.error('Energy contact status skipped:', contactError.message);
    }
  }

  const { error } = await supabase.from('energy_delivery_lines').insert({
    company_id: row.assigned_to,
    product_type: productType,
    lead_id: row.id,
    unit_price: priceFor(profile, productType),
    billing_model: profile?.model || null,
    status: 'OPEN',
    delivered_at: new Date().toISOString(),
  });
  if (error && !/duplicate key|unique/i.test(error.message || '') && !schemaMissing(error)) {
    console.error('Energy delivery line skipped:', error.message);
  }
  return null;
}

export async function getBillingProfile(companyId) {
  const { data, error } = await supabase.from('energy_billing_profiles').select('*').eq('company_id', companyId).maybeSingle();
  if (error) {
    if (schemaMissing(error)) return null;
    throw error;
  }
  return data;
}

function publicProfile(row) {
  if (!row) return null;
  const num = (value) => (value == null ? null : Number(value));
  return {
    companyId: row.company_id,
    model: row.model,
    thresholdQuantity: row.threshold_quantity,
    thresholdAmount: num(row.threshold_amount),
    invoiceDay: row.invoice_day,
    paymentTermDays: row.payment_term_days,
    creditLimit: num(row.credit_limit),
    pricePvLead: num(row.price_pv_lead),
    pricePvAppointment: num(row.price_pv_appointment),
    priceHpLead: num(row.price_hp_lead),
    priceHpAppointment: num(row.price_hp_appointment),
    complaintPeriodDays: row.complaint_period_days,
    complaintBlocksInvoice: row.complaint_blocks_invoice === true,
  };
}

function publicLine(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    productType: row.product_type,
    leadId: row.lead_id,
    unitPrice: row.unit_price == null ? null : Number(row.unit_price),
    billingModel: row.billing_model,
    status: row.status,
    deliveredAt: row.delivered_at,
    invoiceId: row.invoice_id,
    complaintStatus: row.complaint_status,
  };
}

export async function billingView(actor, companyId) {
  const company = companyId || energyCompanyId(actor);
  if (actor.role !== 'admin' && (actor.energyRole || 'main') !== 'main') throw fail('Abrechnung sieht nur die Hauptfirma.', 403);
  if (actor.role !== 'admin' && company !== energyCompanyId(actor)) throw fail('Keine Berechtigung.', 403);
  const profile = await getBillingProfile(company);
  const { data, error } = await supabase.from('energy_delivery_lines').select('*').eq('company_id', company).order('delivered_at', { ascending: false });
  if (error) {
    if (schemaMissing(error)) throw energySchemaError();
    throw error;
  }
  const lines = data || [];
  const open = lines.filter((line) => line.status === 'OPEN' && !(profile?.complaint_blocks_invoice && line.complaint_status === 'pending'));
  return {
    profile: publicProfile(profile),
    lines: lines.map(publicLine),
    openAmount: open.reduce((sum, line) => sum + (Number(line.unit_price) || 0), 0),
    openCount: open.length,
  };
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveBillingProfile(companyId, body) {
  const model = String(body.model || 'MONTHLY').trim();
  if (!BILLING_MODELS.includes(model)) throw fail('Abrechnungsmodell ist ungültig.');
  const row = {
    company_id: companyId,
    model,
    threshold_quantity: numOrNull(body.thresholdQuantity),
    threshold_amount: numOrNull(body.thresholdAmount),
    invoice_day: numOrNull(body.invoiceDay),
    payment_term_days: numOrNull(body.paymentTermDays),
    credit_limit: numOrNull(body.creditLimit),
    price_pv_lead: numOrNull(body.pricePvLead),
    price_pv_appointment: numOrNull(body.pricePvAppointment),
    price_hp_lead: numOrNull(body.priceHpLead),
    price_hp_appointment: numOrNull(body.priceHpAppointment),
    complaint_period_days: numOrNull(body.complaintPeriodDays),
    complaint_blocks_invoice: body.complaintBlocksInvoice === true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('energy_billing_profiles').upsert(row).select('*').single();
  if (error) {
    if (schemaMissing(error)) throw energySchemaError();
    throw error;
  }
  return publicProfile(data);
}

export async function invoiceOpenLines(companyId, invoiceId) {
  const id = String(invoiceId || '').trim();
  if (!id) throw fail('Rechnungsnummer ist erforderlich.');
  const profile = await getBillingProfile(companyId);
  const { data, error } = await supabase.from('energy_delivery_lines').select('*').eq('company_id', companyId).eq('status', 'OPEN');
  if (error) throw error;
  const ids = (data || [])
    .filter((line) => !(profile?.complaint_blocks_invoice && line.complaint_status === 'pending'))
    .map((line) => line.id);
  if (!ids.length) return [];
  const { data: updated, error: updateError } = await supabase
    .from('energy_delivery_lines')
    .update({ status: 'INVOICED', invoice_id: id })
    .in('id', ids)
    .select('*');
  if (updateError) throw updateError;
  return (updated || []).map(publicLine);
}

function publicComplaint(row) {
  return {
    id: row.id,
    leadId: row.lead_id,
    companyId: row.company_id,
    openedBy: row.opened_by,
    reason: row.reason,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

export async function openEnergyComplaint(actor, leadId, { reason, comment }) {
  const { getLeadById } = await import('./leads.js');
  const lead = await assertCompanyLead(actor, await getLeadById(leadId));
  const why = String(reason || '').trim();
  const text = String(comment || '').trim();
  if (!COMPLAINT_REASONS.includes(why)) throw fail('Reklamationsgrund ist ungültig.');
  if (text.length < 20) throw fail('Die Begründung braucht mindestens 20 Zeichen.');
  const profile = await getBillingProfile(lead.assigned_to);
  if (profile?.complaint_period_days) {
    const { data: line } = await supabase.from('energy_delivery_lines').select('delivered_at').eq('lead_id', leadId).maybeSingle();
    const start = new Date(line?.delivered_at || lead.assigned_at || lead.created_at);
    if (Date.now() > start.getTime() + profile.complaint_period_days * 86400000) {
      throw fail('Die Reklamationsfrist ist abgelaufen.');
    }
  }
  const { data, error } = await supabase.from('energy_complaints').insert({
    lead_id: leadId,
    company_id: lead.assigned_to,
    opened_by: actor.id,
    reason: why,
    comment: text,
  }).select('*').single();
  if (error) {
    if (schemaMissing(error)) throw energySchemaError();
    throw error;
  }
  await supabase.from('leads').update({ energy_status: 'COMPLAINT_OPENED' }).eq('id', leadId);
  await supabase.from('energy_delivery_lines').update({ complaint_status: 'pending' }).eq('lead_id', leadId);
  return publicComplaint(data);
}

export async function listEnergyComplaints(actor) {
  let query = supabase.from('energy_complaints').select('*').order('created_at', { ascending: false });
  const role = actor.energyRole || 'main';
  if (actor.role !== 'admin') query = query.eq('company_id', energyCompanyId(actor));
  const { data, error } = await query;
  if (error) {
    if (schemaMissing(error)) throw energySchemaError();
    throw error;
  }
  let rows = data || [];
  if (actor.role !== 'admin' && (role === 'sub_partner' || role === 'field_rep')) {
    const leadIds = [...new Set(rows.map((row) => row.lead_id).filter(Boolean))];
    if (!leadIds.length) return [];
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .in('id', leadIds)
      .eq('energy_holder_id', actor.id);
    if (leadError) throw leadError;
    const allowed = new Set((leads || []).map((lead) => lead.id));
    rows = rows.filter((row) => allowed.has(row.lead_id));
  }
  return rows.map(publicComplaint);
}

export async function attachEnergyComplaints(leads) {
  const list = Array.isArray(leads) ? leads : [leads];
  const ids = list.map((lead) => lead?.id).filter(Boolean);
  if (!ids.length) return list;
  const { data, error } = await supabase
    .from('energy_complaints')
    .select('*')
    .in('lead_id', ids)
    .order('created_at', { ascending: false });
  if (error) {
    if (schemaMissing(error)) return list.map((lead) => ({ ...lead, complaint: lead.complaint || null }));
    throw error;
  }
  const map = new Map();
  (data || []).forEach((row) => {
    if (!map.has(row.lead_id)) map.set(row.lead_id, publicComplaint(row));
  });
  return list.map((lead) => ({ ...lead, complaint: map.get(lead.id) || null }));
}

export async function decideEnergyComplaint(actorId, complaintId, status) {
  const next = String(status || '').trim();
  if (!['approved', 'rejected', 'partial', 'replacement'].includes(next)) throw fail('Entscheidung ist ungültig.');
  const { data: current, error } = await supabase.from('energy_complaints').select('*').eq('id', complaintId).maybeSingle();
  if (error) throw error;
  if (!current) throw fail('Reklamation wurde nicht gefunden.', 404);
  const { data, error: updateError } = await supabase.from('energy_complaints').update({
    status: next,
    decided_at: new Date().toISOString(),
    decided_by: actorId,
  }).eq('id', complaintId).select('*').single();
  if (updateError) throw updateError;
  if (next === 'approved' || next === 'partial') {
    await supabase.from('energy_delivery_lines').update({ status: 'CREDITED', complaint_status: next }).eq('lead_id', current.lead_id);
  } else {
    await supabase.from('energy_delivery_lines').update({ complaint_status: next }).eq('lead_id', current.lead_id);
  }
  return publicComplaint(data);
}

function googleConfigured() {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

function redirectUri() {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${getApiOrigin()}/api/energy/calendar/callback`;
}

function signState(userId) {
  const exp = Date.now() + 10 * 60 * 1000;
  const body = `${userId}.${exp}`;
  const sig = createHmac('sha256', secretKey()).update(body).digest('hex');
  return Buffer.from(`${body}.${sig}`).toString('base64url');
}

function readState(state) {
  const raw = Buffer.from(String(state || ''), 'base64url').toString('utf8');
  const [userId, exp, sig] = raw.split('.');
  const expected = createHmac('sha256', secretKey()).update(`${userId}.${exp}`).digest('hex');
  const given = String(sig || '');
  if (!userId || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    throw fail('Kalender-Anmeldung ist ungültig.', 400);
  }
  if (Number(exp) < Date.now()) throw fail('Kalender-Anmeldung ist abgelaufen.', 400);
  return userId;
}

export function calendarConnectUrl(user) {
  if ((user.energyRole || 'main') !== 'field_rep') throw fail('Nur Außendienst verbindet den eigenen Kalender.', 403);
  if (!googleConfigured()) throw fail('Google Kalender ist noch nicht konfiguriert.', 503);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state: signState(user.id),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function googleToken(body) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const payload = await response.json();
  if (!response.ok) throw fail(payload.error_description || 'Google-Anmeldung ist fehlgeschlagen.', 400);
  return payload;
}

async function connectionFor(userId) {
  const { data, error } = await supabase.from('energy_calendar_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    if (schemaMissing(error)) return null;
    throw error;
  }
  if (!data || data.sync_status === 'disconnected' || !data.refresh_token) return null;
  return data;
}

async function accessTokenFor(connection) {
  if (connection.access_expires_at && new Date(connection.access_expires_at).getTime() > Date.now() + 30000 && connection.access_token) {
    return decryptSecret(connection.access_token);
  }
  const refreshed = await googleToken({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    refresh_token: decryptSecret(connection.refresh_token),
    grant_type: 'refresh_token',
  });
  const expires = new Date(Date.now() + (Number(refreshed.expires_in) || 3600) * 1000).toISOString();
  await supabase.from('energy_calendar_connections').update({
    access_token: encryptSecret(refreshed.access_token),
    access_expires_at: expires,
    updated_at: new Date().toISOString(),
  }).eq('user_id', connection.user_id);
  return refreshed.access_token;
}

export async function connectCalendarFromCode(state, code) {
  const userId = readState(state);
  const token = await googleToken({
    code,
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
  });
  const info = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).then((response) => response.json()).catch(() => ({}));
  const calendars = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).then((response) => response.json());
  const primary = (calendars.items || []).find((item) => item.primary) || calendars.items?.[0];
  const { error } = await supabase.from('energy_calendar_connections').upsert({
    user_id: userId,
    google_account_id: info.id || info.email || null,
    calendar_id: primary?.id || 'primary',
    refresh_token: encryptSecret(token.refresh_token),
    access_token: encryptSecret(token.access_token),
    access_expires_at: new Date(Date.now() + (Number(token.expires_in) || 3600) * 1000).toISOString(),
    sync_status: 'connected',
    sync_error: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await createTestEvent(userId).catch((err) => console.error('Energy test event failed:', err.message));
  return userId;
}

async function createTestEvent(userId) {
  const connection = await connectionFor(userId);
  const token = await accessTokenFor(connection);
  const start = new Date(Date.now() + 5 * 60 * 1000);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: 'Vantaro Testtermin',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    }),
  });
  const event = await response.json();
  if (!response.ok) throw fail(event.error?.message || 'Testtermin fehlgeschlagen.');
  await supabase.from('energy_calendar_connections').update({
    test_event_id: event.id,
    last_synced_at: new Date().toISOString(),
  }).eq('user_id', userId);
}

export async function calendarStatus(userId) {
  const connection = await connectionFor(userId);
  if (!connection) return { configured: googleConfigured(), syncStatus: 'disconnected', calendarId: null, syncError: null };
  return {
    configured: googleConfigured(),
    syncStatus: connection.sync_status,
    calendarId: connection.calendar_id,
    syncError: connection.sync_error,
    lastSyncedAt: connection.last_synced_at,
  };
}

export async function disconnectCalendar(userId) {
  await supabase.from('energy_calendar_connections').update({
    sync_status: 'disconnected',
    refresh_token: null,
    access_token: null,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  return { syncStatus: 'disconnected' };
}

async function syncGoogleEvent(lead, holderId, mode) {
  const connection = await connectionFor(holderId);
  if (!connection) {
    if (lead.delivery_type === 'appointment') {
      await supabase.from('leads').update({ calendar_sync_status: 'pending', energy_status: 'CALENDAR_PENDING' }).eq('id', lead.id);
    }
    return;
  }
  const token = await accessTokenFor(connection);
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id || 'primary')}/events`;
  if (mode === 'delete' && lead.google_event_id) {
    await fetch(`${base}/${encodeURIComponent(lead.google_event_id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await supabase.from('leads').update({ calendar_sync_status: 'disconnected', google_event_id: null }).eq('id', lead.id);
    return;
  }
  if (lead.google_event_id && mode !== 'update') {
    const existing = await fetch(`${base}/${encodeURIComponent(lead.google_event_id)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (existing.ok) {
      const event = await existing.json();
      const remoteStart = event.start?.dateTime ? new Date(event.start.dateTime).toISOString() : null;
      const localStart = lead.appointment_at ? new Date(lead.appointment_at).toISOString() : null;
      if (remoteStart && localStart && remoteStart !== localStart) {
        await supabase.from('leads').update({ calendar_sync_status: 'error' }).eq('id', lead.id);
        await supabase.from('energy_calendar_connections').update({
          sync_status: 'error',
          sync_error: 'Kalenderkonflikt: Termin wurde in Google verschoben.',
        }).eq('user_id', holderId);
        return;
      }
    }
  }
  const start = new Date(lead.appointment_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const response = await fetch(mode === 'update' && lead.google_event_id ? `${base}/${encodeURIComponent(lead.google_event_id)}` : base, {
    method: mode === 'update' && lead.google_event_id ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: 'Vantaro Termin',
      description: 'Termin aus Vantaro Energy. Vantaro bleibt führend für Status und Abrechnung.',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    }),
  });
  const event = await response.json();
  if (!response.ok) {
    await supabase.from('energy_calendar_connections').update({
      sync_status: 'error',
      sync_error: event.error?.message || 'Sync fehlgeschlagen',
    }).eq('user_id', holderId);
    return;
  }
  await supabase.from('leads').update({
    google_event_id: event.id,
    google_event_etag: event.etag || null,
    calendar_sync_status: 'connected',
    energy_status: 'CALENDAR_SYNCED',
  }).eq('id', lead.id);
  await supabase.from('energy_calendar_connections').update({
    sync_status: 'connected',
    sync_error: null,
    last_synced_at: new Date().toISOString(),
  }).eq('user_id', holderId);
}

async function notifyEnergyAssignment(holder, lead) {
  if (!hasCustomMailer() || !holder?.email) return;
  const { sendEnergyNoticeEmail } = await import('./mailer.js');
  const kind = lead.delivery_type === 'appointment' ? 'Neuer Termin' : 'Neuer Lead';
  await sendEnergyNoticeEmail({
    to: holder.email,
    subject: kind,
    text: `${kind} wurde Ihnen in Vantaro zugewiesen. Details stehen im Portal.`,
  });
}

export function calendarReturnUrl(ok) {
  return `${getClientOrigin()}/dashboard/kalender?calendar=${ok ? 'connected' : 'error'}`;
}
