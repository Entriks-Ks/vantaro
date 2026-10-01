import { randomInt } from 'node:crypto';
import { supabase } from './supabase.js';
import { normalizePartnerPages, publicUser } from './auth.js';
import { removeHolderCalendarEvent, syncLeadCalendar } from './energy.js';
import { getLeadById, listMyLeads, withAssignee, withAssignees } from './leads.js';
import { hasCustomMailer } from './mailer.js';
import { issuePasswordReset } from './passwordReset.js';
import { ROLES } from './roles.js';
import { verticalOrInsurance } from './vertical.js';

const PARTNER_ROLES = {
  energy: ['dispatcher', 'sub_partner', 'field_rep'],
  insurance: ['dispatcher', 'sub_partner'],
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function partnerRolesFor(vertical) {
  return PARTNER_ROLES[verticalOrInsurance(vertical)];
}

function holdsOwnLeads(role) {
  return role === 'sub_partner' || role === 'field_rep';
}

function holderColumnMissing(error) {
  const message = String(error?.message || error?.code || '');
  return /energy_holder_id|google_event_id/i.test(message)
    && (/column|schema cache/i.test(message) || error?.code === 'PGRST204' || error?.code === '42703');
}

function partnerSchemaError() {
  return fail('Partner-Zuweisung fehlt. Bitte server/supabase/energy_portal.sql im Supabase SQL Editor ausführen.', 503);
}

function tableMissing(error) {
  return ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error?.code)
    || /relation|schema cache|does not exist/i.test(String(error?.message || ''));
}

export function companyIdOf(user) {
  return user?.companyId || null;
}

export function canReadCompanyLead(user, row) {
  if (!row || verticalOrInsurance(row.vertical) !== user?.vertical) return false;
  const companyId = companyIdOf(user);
  if (!companyId || row.assigned_to !== companyId) return false;
  if (holdsOwnLeads(user.partnerRole)) return row.energy_holder_id === user.id;
  return true;
}

export async function listVisibleCompanyLeads(user) {
  const companyId = companyIdOf(user);
  if (!companyId) return [];
  const role = user.partnerRole || 'main';
  if (!holdsOwnLeads(role)) return listMyLeads(companyId, { vertical: user.vertical });

  let query = supabase
    .from('leads')
    .select('*')
    .eq('vertical', user.vertical)
    .eq('assigned_to', companyId)
    .eq('energy_holder_id', user.id)
    .is('refunded_at', null);
  if (role === 'field_rep') query = query.eq('delivery_type', 'appointment');
  const { data, error } = await query.order('assigned_at', { ascending: false });
  if (error) {
    if (holderColumnMissing(error)) throw partnerSchemaError();
    throw error;
  }
  return withAssignees(data || []);
}

async function loadUser(id) {
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data?.user) return null;
  return data.user;
}

function toPartner(raw) {
  const user = publicUser(raw);
  const metadata = raw.user_metadata || {};
  const accepted = metadata.energy_invite_accepted === true || Boolean(raw.last_sign_in_at);
  return {
    id: user.id,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    partnerRole: user.partnerRole,
    active: user.partnerActive !== false,
    pages: user.partnerPages,
    inviteStatus: accepted ? 'accepted' : 'pending',
    lastSignInAt: raw.last_sign_in_at || null,
    createdAt: raw.created_at || null,
  };
}

export async function listPartners(actor) {
  if (!['main', 'dispatcher'].includes(actor.partnerRole || 'main') && actor.role !== ROLES.ADMIN) {
    throw fail('Keine Berechtigung.', 403);
  }
  const companyId = companyIdOf(actor);
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
      return user?.vertical === actor.vertical && user.companyId === companyId && user.id !== companyId;
    })
    .map(toPartner)
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

function cleanName(firstName, lastName) {
  const given = String(firstName || '').trim();
  const family = String(lastName || '').trim();
  if (given.length < 2 || family.length < 2) throw fail('Vor- und Nachname müssen mindestens 2 Zeichen haben.');
  return { given, family };
}

function cleanEmail(email) {
  const mail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw fail('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
  return mail;
}

function cleanRole(role, vertical) {
  const value = String(role || '').trim();
  if (!partnerRolesFor(vertical).includes(value)) throw fail('Rolle ist ungültig.');
  return value;
}

export async function createPartner(actor, { firstName, lastName, email, partnerRole, pages }) {
  if ((actor.partnerRole || 'main') !== 'main') throw fail('Nur die Hauptfirma kann Unterpartner anlegen.', 403);
  const role = cleanRole(partnerRole, actor.vertical);
  const { given, family } = cleanName(firstName, lastName);
  const mail = cleanEmail(email);
  const password = generatePassword();
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
      vertical: actor.vertical,
      vertical_required: false,
      energy_role: role,
      energy_company_id: companyIdOf(actor),
      energy_active: true,
      energy_pages: normalizePartnerPages(pages, actor.vertical),
      energy_invite_accepted: false,
    },
    app_metadata: { role: ROLES.BERATER },
  });
  if (error) throw fail(error.message || 'Zugang konnte nicht angelegt werden.');
  return { user: toPartner(data.user), password };
}

async function loadManagedPartner(actor, partnerId) {
  if ((actor.partnerRole || 'main') !== 'main' && actor.role !== ROLES.ADMIN) {
    throw fail('Nur die Hauptfirma kann Unterpartner verwalten.', 403);
  }
  if (!partnerId) throw fail('Unterpartner wurde nicht gefunden.', 404);
  const companyId = companyIdOf(actor);
  const raw = await loadUser(partnerId);
  if (!raw) throw fail('Unterpartner wurde nicht gefunden.', 404);
  const mapped = publicUser(raw);
  if (mapped.vertical !== actor.vertical || mapped.companyId !== companyId || mapped.id === companyId) {
    throw fail('Dieser Zugang gehört nicht zur Hauptfirma.');
  }
  if (!partnerRolesFor(mapped.vertical).includes(mapped.partnerRole)) {
    throw fail('Dieser Zugang kann nicht bearbeitet werden.');
  }
  return { raw, mapped, companyId };
}

export async function updatePartner(actor, partnerId, { active, pages, partnerRole, firstName, lastName, email } = {}) {
  const { raw, mapped } = await loadManagedPartner(actor, partnerId);

  const metadata = { ...(raw.user_metadata || {}) };
  const patch = {};
  if (firstName != null || lastName != null) {
    const { given, family } = cleanName(firstName ?? metadata.first_name, lastName ?? metadata.last_name);
    metadata.first_name = given;
    metadata.last_name = family;
    metadata.full_name = `${given} ${family}`;
  }
  if (email != null) {
    const mail = cleanEmail(email);
    if (mail !== String(raw.email || '').toLowerCase()) {
      patch.email = mail;
      patch.email_confirm = true;
    }
  }
  if (partnerRole != null) metadata.energy_role = cleanRole(partnerRole, mapped.vertical);
  if (pages != null) metadata.energy_pages = normalizePartnerPages(pages, mapped.vertical);
  if (active != null) metadata.energy_active = active === true;

  patch.user_metadata = metadata;
  if (active === true) patch.ban_duration = 'none';
  if (active === false) patch.ban_duration = '876600h';

  const { data, error } = await supabase.auth.admin.updateUserById(partnerId, patch);
  if (error) throw fail(error.message || 'Unterpartner konnte nicht aktualisiert werden.');
  return toPartner(data.user);
}

export async function sendPartnerPasswordLink(actor, partnerId) {
  const { raw } = await loadManagedPartner(actor, partnerId);
  if (!hasCustomMailer()) {
    throw fail('E-Mail-Versand ist nicht konfiguriert. Bitte „Neues Passwort erstellen“ verwenden.', 503);
  }
  try {
    await issuePasswordReset(raw);
  } catch (error) {
    if (error.code === 'cooldown') throw fail(error.message, 429);
    throw error;
  }
  return { email: raw.email };
}

export async function resetPartnerPassword(actor, partnerId) {
  await loadManagedPartner(actor, partnerId);
  const password = generatePassword();
  const { data, error } = await supabase.auth.admin.updateUserById(partnerId, { password });
  if (error) throw fail(error.message || 'Passwort konnte nicht zurückgesetzt werden.');
  return { user: toPartner(data.user), password };
}

async function reassignRows(table, column, fromId, toId) {
  const { error } = await supabase.from(table).update({ [column]: toId }).eq(column, fromId);
  if (error && !tableMissing(error)) throw error;
}

// Complaints reference auth.users with ON DELETE CASCADE, so they must be moved
// to the company before the partner login is removed.
export async function deletePartner(actor, partnerId) {
  const { companyId } = await loadManagedPartner(actor, partnerId);

  const { data: held, error: heldError } = await supabase
    .from('leads')
    .select('*')
    .eq('energy_holder_id', partnerId);
  if (heldError && !holderColumnMissing(heldError)) throw heldError;
  for (const lead of held || []) {
    if (!lead.google_event_id) continue;
    await removeHolderCalendarEvent(lead, partnerId).catch((err) => {
      console.error('Partner calendar cleanup failed:', err.message);
    });
  }
  if (held?.length) {
    const { error } = await supabase
      .from('leads')
      .update({ energy_holder_id: null, google_event_id: null })
      .eq('energy_holder_id', partnerId);
    if (error) throw error;
  }

  await reassignRows('lead_complaints', 'berater_id', partnerId, companyId);
  await reassignRows('energy_complaints', 'opened_by', partnerId, companyId);

  const { error } = await supabase.auth.admin.deleteUser(partnerId);
  if (error) throw fail(error.message || 'Unterpartner konnte nicht gelöscht werden.');
  return { id: partnerId, unassignedLeads: held?.length || 0 };
}

export async function assignLeadHolder(actor, leadId, holderId) {
  if (!['main', 'dispatcher'].includes(actor.partnerRole || 'main') && actor.role !== ROLES.ADMIN) {
    throw fail('Nur Hauptfirma oder Dispatcher können zuweisen.', 403);
  }
  const lead = await getLeadById(leadId);
  if (!lead) throw fail('Lead wurde nicht gefunden.', 404);
  if (actor.role !== ROLES.ADMIN && !canReadCompanyLead(actor, lead)) throw fail('Keine Berechtigung.', 403);

  const vertical = verticalOrInsurance(lead.vertical);
  const holder = await loadUser(holderId);
  if (!holder) throw fail('Unterpartner wurde nicht gefunden.');
  const mapped = publicUser(holder);
  if (mapped.vertical !== vertical || mapped.companyId !== lead.assigned_to || mapped.id === lead.assigned_to) {
    throw fail('Dieser Zugang gehört nicht zur Hauptfirma.');
  }
  if (!partnerRolesFor(vertical).includes(mapped.partnerRole)) throw fail('Dieser Zugang kann keine Leads erhalten.');
  if (mapped.partnerActive === false) throw fail('Dieser Zugang ist deaktiviert.');

  const previousHolderId = lead.energy_holder_id;
  const reassigned = Boolean(previousHolderId) && previousHolderId !== holderId;
  if (reassigned && lead.google_event_id) {
    await removeHolderCalendarEvent(lead, previousHolderId).catch((err) => {
      console.error('Partner calendar cleanup failed:', err.message);
    });
  }
  const patch = { energy_holder_id: holderId };
  if (reassigned) patch.google_event_id = null;
  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', leadId)
    .select('*')
    .single();
  if (error) {
    if (holderColumnMissing(error)) throw partnerSchemaError();
    throw error;
  }
  if (vertical === 'energy') {
    await syncLeadCalendar(reassigned ? { ...lead, appointment_at: null, google_event_id: null } : lead, data).catch((err) => {
      console.error('Energy calendar sync failed:', err.message);
    });
  }
  notifyAssignment(mapped, data).catch(() => {});
  return withAssignee(data);
}

async function notifyAssignment(holder, lead) {
  if (!hasCustomMailer() || !holder?.email) return;
  const { sendEnergyNoticeEmail } = await import('./mailer.js');
  const kind = lead.delivery_type === 'appointment' ? 'Neuer Termin' : 'Neuer Lead';
  await sendEnergyNoticeEmail({
    to: holder.email,
    subject: kind,
    text: `${kind} wurde Ihnen in Vantaro zugewiesen. Details stehen im Portal.`,
  });
}
