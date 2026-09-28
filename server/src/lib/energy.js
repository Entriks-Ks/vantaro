import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { supabase } from './supabase.js';
import { publicUser, normalizeEnergyPages } from './auth.js';
import { getApiOrigin, getClientOrigin } from './clientOrigin.js';
import { hasCustomMailer } from './mailer.js';
import { ROLES } from './roles.js';
import { verticalOrInsurance } from './vertical.js';

const PARTNER_ROLES = ['dispatcher', 'sub_partner', 'field_rep'];

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function schemaMissing(error) {
  const message = String(error?.message || error?.code || '');
  return /energy_holder_id|google_event_id|calendar_sync_status|energy_calendar/i.test(message)
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
  if (mapped.energyActive === false) throw fail('Dieser Zugang ist deaktiviert.');
  const previousHolderId = lead.energy_holder_id;
  const reassigned = Boolean(previousHolderId) && previousHolderId !== holderId;
  if (reassigned && lead.google_event_id) {
    await syncGoogleEvent(lead, previousHolderId, 'delete').catch((err) => {
      console.error('Energy calendar cleanup failed:', err.message);
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
    if (schemaMissing(error)) throw energySchemaError();
    throw error;
  }
  await syncLeadCalendar(reassigned ? { ...lead, appointment_at: null, google_event_id: null } : lead, data).catch((err) => {
    console.error('Energy calendar sync failed:', err.message);
  });
  notifyEnergyAssignment(mapped, data).catch(() => {});
  return withAssignee(data);
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

export async function syncLeadCalendar(previous, next) {
  if (!next?.energy_holder_id) return;
  const holderId = next.energy_holder_id;
  const scheduled = next.contact_status === 'termin' && next.appointment_at;
  if (!scheduled) {
    if (previous?.google_event_id) {
      await syncGoogleEvent({ ...next, google_event_id: previous.google_event_id }, holderId, 'delete');
    }
    return;
  }
  const before = previous?.appointment_at ? new Date(previous.appointment_at).toISOString() : '';
  const after = new Date(next.appointment_at).toISOString();
  if (before === after && next.google_event_id) return;
  await syncGoogleEvent(next, holderId, next.google_event_id ? 'update' : 'insert');
}

async function syncGoogleEvent(lead, holderId, mode) {
  if (mode !== 'delete' && !lead.appointment_at) return;
  const connection = await connectionFor(holderId);
  if (!connection) {
    if (lead.delivery_type === 'appointment' && mode !== 'delete') {
      await supabase.from('leads').update({ calendar_sync_status: 'pending' }).eq('id', lead.id);
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
