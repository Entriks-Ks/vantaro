import { Router } from 'express';
import { supabase } from '../../lib/supabase.js';
import { isUuid } from '../../lib/leads.js';
import { buildFullName, normalizePhone } from '../../lib/profile.js';
import { ROLES, STAFF_ROLES, getUserRole } from '../../lib/roles.js';
import { findUserByEmail, isEmailVerified, isOAuthUser, toDirectoryUser } from '../../lib/users.js';
import { issueVerificationCode } from '../../lib/verification.js';
import { issuePasswordReset } from '../../lib/passwordReset.js';
import { toPublicPayment } from '../../lib/payments.js';
import { diffFields, listActivityFor, logItAction } from '../../lib/itSupportAudit.js';
import { fail, optionalReason, pageParams, requireDb, requireReason, route, searchTerm } from './common.js';
import { both, tr } from './i18n.js';

const router = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAN_FOREVER = '876000h';

function providersOf(raw) {
  const fromIdentities = (raw.identities || []).map((identity) => String(identity.provider || '').toLowerCase());
  const fromMeta = Array.isArray(raw.app_metadata?.providers) ? raw.app_metadata.providers : [];
  return [...new Set([...fromIdentities, ...fromMeta].filter(Boolean))];
}

function consoleUser(raw) {
  const base = toDirectoryUser(raw);
  const meta = raw.user_metadata || {};
  const bannedUntil = raw.banned_until || null;
  const blocked = Boolean(bannedUntil) && new Date(bannedUntil).getTime() > Date.now();
  const verification = meta.email_verification || null;
  return {
    ...base,
    firstName: meta.first_name || '',
    lastName: meta.last_name || '',
    providers: providersOf(raw),
    blocked,
    bannedUntil: blocked ? bannedUntil : null,
    emailConfirmedAt: raw.email_confirmed_at || null,
    verificationPending: Boolean(verification),
    verificationMethod: verification?.method || null,
    verificationExpiresAt: verification?.expires_at || null,
    verificationAttempts: Number(verification?.attempts) || 0,
    passwordResetPending: Boolean(meta.password_reset),
    passwordResetSentAt: meta.password_reset?.last_sent_at || null,
    needsVertical: meta.vertical_required === true && !meta.vertical,
    staff: STAFF_ROLES.has(base.role),
    updatedAt: raw.updated_at || null,
  };
}

async function listAllAuthUsers() {
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...(data.users || []));
    if ((data.users || []).length < 200) break;
  }
  return users;
}

async function loadAuthUser(req) {
  const t = tr(req);
  if (!isUuid(req.params.id)) throw fail(t('Nutzer wurde nicht gefunden.', 'User not found.'), 404);
  const { data, error } = await supabase.auth.admin.getUserById(req.params.id);
  if (error || !data?.user) throw fail(t('Nutzer wurde nicht gefunden.', 'User not found.'), 404);
  return data.user;
}

function userLabel(raw) {
  const meta = raw?.user_metadata || {};
  const name = meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
  return name ? `${name} <${raw.email}>` : raw?.email || raw?.id;
}

/** Staff accounts (admin, IT Support) cannot be changed from the console: no privilege games. */
function assertManageable(req, raw, { allowSelf = false } = {}) {
  const t = tr(req);
  const role = getUserRole(raw);
  if (raw.id === req.user.id && !allowSelf) {
    throw fail(t('Diese Aktion ist für das eigene Konto nicht möglich.', 'This action is not possible for your own account.'), 403);
  }
  if (STAFF_ROLES.has(role) && raw.id !== req.user.id) {
    throw fail(t('Admin- und IT-Support-Konten können in der Konsole nicht verändert werden.', 'Admin and IT Support accounts cannot be changed in the console.'), 403);
  }
  return role;
}

async function updateAuthUser(req, id, attributes) {
  const { data, error } = await supabase.auth.admin.updateUserById(id, attributes);
  if (error) throw fail(tr(req)(`Supabase hat die Änderung abgelehnt: ${error.message}`, `Supabase rejected the change: ${error.message}`), 400);
  return data.user;
}

router.get('/', route(async (req, res) => {
  requireDb(req);
  const { limit, page, from } = pageParams(req, { def: 25, max: 100 });
  const all = (await listAllAuthUsers()).map(consoleUser)
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

  const counts = {
    total: all.length,
    berater: all.filter((user) => user.role === ROLES.BERATER).length,
    staff: all.filter((user) => user.staff).length,
    unverified: all.filter((user) => !user.verified).length,
    blocked: all.filter((user) => user.blocked).length,
    partnerInactive: all.filter((user) => !user.partnerActive).length,
    onboardingOpen: all.filter((user) => user.role === ROLES.BERATER && !user.onboardingComplete).length,
  };

  let users = all;
  const role = String(req.query.role || '');
  if (role === 'staff') users = users.filter((user) => user.staff);
  else if (Object.values(ROLES).includes(role)) users = users.filter((user) => user.role === role);
  const status = String(req.query.status || '');
  if (status === 'unverified') users = users.filter((user) => !user.verified);
  else if (status === 'blocked') users = users.filter((user) => user.blocked);
  else if (status === 'partner_inactive') users = users.filter((user) => !user.partnerActive);
  else if (status === 'onboarding') users = users.filter((user) => user.role === ROLES.BERATER && !user.onboardingComplete);
  const vertical = String(req.query.vertical || '');
  if (vertical === 'energy' || vertical === 'insurance') users = users.filter((user) => user.vertical === vertical);

  const q = searchTerm(req.query.q).toLowerCase();
  if (q) {
    users = users.filter((user) => [user.id, user.email, user.fullName, user.company, user.customerNumber, user.phone]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }

  res.json({ users: users.slice(from, from + limit), total: users.length, page, limit, counts });
}));

router.get('/:id', route(async (req, res) => {
  requireDb(req);
  const raw = await loadAuthUser(req);
  const user = consoleUser(raw);

  const [leadCount, requests, payments, securityEvents, activity, company] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', raw.id).is('refunded_at', null)
      .then(({ count }) => count || 0, () => 0),
    supabase.from('lead_requests').select('id, code, status, requested_count, lead_type, scope, created_at')
      .eq('berater_id', raw.id).order('created_at', { ascending: false }).limit(20)
      .then(({ data, error }) => (error ? [] : (data || []).map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        requestedCount: row.requested_count,
        leadType: row.lead_type,
        scope: row.scope,
        createdAt: row.created_at,
      })))),
    supabase.from('lead_payments').select('*').eq('berater_id', raw.id).order('created_at', { ascending: false }).limit(20)
      .then(({ data, error }) => (error ? [] : (data || []).map((row) => toPublicPayment(row)))),
    supabase.from('payment_audit_log').select('id, event, ip, metadata, created_at').eq('user_id', raw.id)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data, error }) => (error ? [] : data || [])),
    listActivityFor('user', raw.id),
    user.partnerRole !== 'main' && isUuid(user.companyId)
      ? supabase.auth.admin.getUserById(user.companyId).then(({ data }) => (data?.user ? toDirectoryUser(data.user) : null), () => null)
      : Promise.resolve(null),
  ]);

  res.json({
    user,
    stats: { leadCount, requestCount: requests.length, paymentCount: payments.length },
    requests,
    payments,
    securityEvents,
    activity,
    company,
    manageable: raw.id === req.user.id || !user.staff,
    self: raw.id === req.user.id,
  });
}));

router.patch('/:id', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const raw = await loadAuthUser(req);
  const role = assertManageable(req, raw, { allowSelf: true });
  const meta = raw.user_metadata || {};
  const body = req.body || {};
  const nextMeta = { ...meta };
  const before = { firstName: meta.first_name || '', lastName: meta.last_name || '', phone: meta.phone || '', company: meta.company || '', email: raw.email };
  const after = { ...before };

  if ('firstName' in body || 'lastName' in body) {
    const firstName = String(body.firstName ?? meta.first_name ?? '').trim().slice(0, 80);
    const lastName = String(body.lastName ?? meta.last_name ?? '').trim().slice(0, 80);
    if (!firstName) throw fail(t('Vorname darf nicht leer sein.', 'First name must not be empty.'));
    nextMeta.first_name = firstName;
    nextMeta.last_name = lastName;
    nextMeta.full_name = buildFullName(firstName, lastName);
    after.firstName = firstName;
    after.lastName = lastName;
  }
  if ('phone' in body) {
    const rawPhone = String(body.phone || '').trim();
    const phone = normalizePhone(rawPhone);
    if (rawPhone && !phone) throw fail(t('Telefonnummer ist ungültig.', 'Phone number is invalid.'));
    nextMeta.phone = phone;
    after.phone = phone;
  }
  if ('company' in body) {
    nextMeta.company = String(body.company || '').trim().slice(0, 160);
    after.company = nextMeta.company;
  }

  const attributes = {};
  if ('email' in body && String(body.email || '').trim().toLowerCase() !== String(raw.email).toLowerCase()) {
    if (role !== ROLES.BERATER) throw fail(t('Die E-Mail-Adresse kann nur bei Berater-Konten geändert werden.', 'The email address can only be changed for advisor accounts.'), 403);
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) throw fail(t('E-Mail-Adresse ist ungültig.', 'Email address is invalid.'));
    const existing = await findUserByEmail(email);
    if (existing && existing.id !== raw.id) throw fail(t('Diese E-Mail-Adresse ist bereits einem anderen Konto zugeordnet.', 'This email address already belongs to another account.'), 409);
    attributes.email = email;
    attributes.email_confirm = true;
    after.email = email;
  }

  const diff = diffFields(before, after);
  if (!diff.changed.length) throw fail(t('Keine Änderungen übermittelt.', 'No changes submitted.'));
  if (diff.changed.some((key) => key !== 'email')) attributes.user_metadata = nextMeta;
  // Changing the login e-mail is sensitive: a reason is mandatory.
  const reason = diff.changed.includes('email') ? requireReason(req) : optionalReason(req);
  const updated = await updateAuthUser(req, raw.id, attributes);
  await logItAction(req, {
    action: 'user.update',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason,
    summary: both(`Nutzerdaten geändert: ${diff.changed.join(', ')}`, `User details changed: ${diff.changed.join(', ')}`),
    before: diff.before,
    after: diff.after,
  });
  res.json({ user: consoleUser(updated) });
}));

router.post('/:id/verify-email', route(async (req, res) => {
  requireDb(req);
  const reason = requireReason(req);
  const raw = await loadAuthUser(req);
  assertManageable(req, raw);
  if (isEmailVerified(raw)) throw fail(tr(req)('Die E-Mail-Adresse ist bereits bestätigt.', 'The email address is already confirmed.'));
  const metadata = { ...(raw.user_metadata || {}) };
  delete metadata.email_verification;
  metadata.email_verified = true;
  const updated = await updateAuthUser(req, raw.id, { email_confirm: true, user_metadata: metadata });
  await logItAction(req, {
    action: 'user.verify_email',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason,
    summary: both('E-Mail-Adresse manuell bestätigt', 'Email address confirmed manually'),
    before: { verified: false },
    after: { verified: true },
  });
  res.json({ user: consoleUser(updated) });
}));

router.post('/:id/resend-verification', route(async (req, res) => {
  requireDb(req);
  const raw = await loadAuthUser(req);
  assertManageable(req, raw);
  if (isEmailVerified(raw)) throw fail(tr(req)('Die E-Mail-Adresse ist bereits bestätigt.', 'The email address is already confirmed.'));
  const updated = await issueVerificationCode(raw, { ignoreCooldown: true });
  await logItAction(req, {
    action: 'user.resend_verification',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason: optionalReason(req),
    summary: both('Neuen Bestätigungscode per E-Mail gesendet (15 Minuten gültig)', 'New confirmation code sent by email (valid for 15 minutes)'),
  });
  res.json({ user: consoleUser(updated) });
}));

router.post('/:id/password-reset', route(async (req, res) => {
  requireDb(req);
  const raw = await loadAuthUser(req);
  const providers = providersOf(raw);
  if (isOAuthUser(raw) && !providers.includes('email')) {
    throw fail(tr(req)(
      `Dieses Konto meldet sich über ${providers.join(', ')} an und hat kein VANTARO-Passwort.`,
      `This account signs in with ${providers.join(', ')} and has no VANTARO password.`,
    ));
  }
  // Allowed for every account: the link only goes to the account's own inbox.
  await issuePasswordReset(raw, { ignoreCooldown: true });
  await logItAction(req, {
    action: 'user.password_reset',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason: optionalReason(req),
    summary: both('Link zum Zurücksetzen des Passworts gesendet (30 Minuten gültig)', 'Password reset link sent (valid for 30 minutes)'),
  });
  res.json({ ok: true });
}));

router.post('/:id/block', route(async (req, res) => {
  requireDb(req);
  const reason = requireReason(req);
  const raw = await loadAuthUser(req);
  assertManageable(req, raw);
  const updated = await updateAuthUser(req, raw.id, { ban_duration: BAN_FOREVER });
  await logItAction(req, {
    action: 'user.block',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason,
    summary: both('Konto gesperrt (Anmeldung nicht mehr möglich)', 'Account blocked (sign-in no longer possible)'),
    before: { blocked: false },
    after: { blocked: true },
  });
  res.json({ user: consoleUser(updated) });
}));

router.post('/:id/unblock', route(async (req, res) => {
  requireDb(req);
  const raw = await loadAuthUser(req);
  assertManageable(req, raw);
  const updated = await updateAuthUser(req, raw.id, { ban_duration: 'none' });
  await logItAction(req, {
    action: 'user.unblock',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason: optionalReason(req),
    summary: both('Kontosperre aufgehoben', 'Account unblocked'),
    before: { blocked: true },
    after: { blocked: false },
  });
  res.json({ user: consoleUser(updated) });
}));

router.post('/:id/partner-access', route(async (req, res) => {
  requireDb(req);
  const raw = await loadAuthUser(req);
  assertManageable(req, raw);
  const user = consoleUser(raw);
  if (user.partnerRole === 'main') {
    throw fail(tr(req)('Nur Unterpartner-Zugänge können aktiviert oder deaktiviert werden.', 'Only sub-partner accounts can be activated or deactivated.'));
  }
  const active = req.body?.active === true;
  const reason = active ? optionalReason(req) : requireReason(req);
  const updated = await updateAuthUser(req, raw.id, {
    user_metadata: { ...(raw.user_metadata || {}), energy_active: active },
  });
  await logItAction(req, {
    action: active ? 'user.partner_activate' : 'user.partner_deactivate',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason,
    summary: active
      ? both('Unterpartner-Zugang aktiviert', 'Sub-partner access activated')
      : both('Unterpartner-Zugang deaktiviert', 'Sub-partner access deactivated'),
    before: { partnerActive: user.partnerActive },
    after: { partnerActive: active },
  });
  res.json({ user: consoleUser(updated) });
}));

router.post('/:id/reset-onboarding', route(async (req, res) => {
  requireDb(req);
  const reason = requireReason(req);
  const raw = await loadAuthUser(req);
  const role = assertManageable(req, raw);
  if (role !== ROLES.BERATER) throw fail(tr(req)('Nur Berater-Konten haben eine Ersteinrichtung.', 'Only advisor accounts have an initial setup.'));
  const updated = await updateAuthUser(req, raw.id, {
    user_metadata: { ...(raw.user_metadata || {}), onboarding_complete: false },
  });
  await logItAction(req, {
    action: 'user.reset_onboarding',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason,
    summary: both(
      'Ersteinrichtung zurückgesetzt – Stammdaten werden beim nächsten Login erneut abgefragt',
      'Initial setup reset – company details are requested again at the next sign-in',
    ),
    before: { onboardingComplete: raw.user_metadata?.onboarding_complete === true },
    after: { onboardingComplete: false },
  });
  res.json({ user: consoleUser(updated) });
}));

router.delete('/:id', route(async (req, res) => {
  requireDb(req);
  const t = tr(req);
  const reason = requireReason(req);
  const raw = await loadAuthUser(req);
  const role = assertManageable(req, raw);
  if (role !== ROLES.BERATER) throw fail(t('Nur Berater-Konten können gelöscht werden.', 'Only advisor accounts can be deleted.'), 403);
  if (String(req.body?.confirmEmail || '').trim().toLowerCase() !== String(raw.email).toLowerCase()) {
    throw fail(t('Zur Bestätigung bitte die E-Mail-Adresse des Kontos exakt eingeben.', 'To confirm, please type the account\'s email address exactly.'));
  }

  const [paid, leads, requests] = await Promise.all([
    supabase.from('lead_payments').select('id', { count: 'exact', head: true }).eq('berater_id', raw.id).in('status', ['paid', 'refunded']),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', raw.id),
    supabase.from('lead_requests').select('id', { count: 'exact', head: true }).eq('berater_id', raw.id).in('status', ['active', 'pending']),
  ]);
  const blockers = [];
  if (paid.count) blockers.push(t(`${paid.count} bezahlte Zahlung(en) – Rechnungsdaten müssen erhalten bleiben`, `${paid.count} paid payment(s) – invoice records must be kept`));
  if (leads.count) blockers.push(t(`${leads.count} zugewiesene Lead(s)`, `${leads.count} assigned lead(s)`));
  if (requests.count) blockers.push(t(`${requests.count} offene(r) Auftrag/Aufträge`, `${requests.count} open order(s)`));
  if (blockers.length) {
    throw fail(t(
      `Konto kann nicht gelöscht werden: ${blockers.join(', ')}. Sperren Sie das Konto stattdessen.`,
      `The account cannot be deleted: ${blockers.join(', ')}. Block the account instead.`,
    ), 409);
  }

  const snapshot = consoleUser(raw);
  const { error } = await supabase.auth.admin.deleteUser(raw.id);
  if (error) throw fail(t(`Supabase hat das Löschen abgelehnt: ${error.message}`, `Supabase refused the deletion: ${error.message}`), 400);
  await logItAction(req, {
    action: 'user.delete',
    targetType: 'user',
    targetId: raw.id,
    targetLabel: userLabel(raw),
    reason,
    summary: both('Berater-Konto gelöscht', 'Advisor account deleted'),
    before: {
      email: snapshot.email,
      fullName: snapshot.fullName,
      company: snapshot.company,
      customerNumber: snapshot.customerNumber,
      vertical: snapshot.vertical,
      createdAt: snapshot.createdAt,
    },
  });
  res.json({ ok: true });
}));

export default router;
