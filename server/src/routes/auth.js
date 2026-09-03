import { Router } from 'express';
import { getBearerToken, mapAuthError, publicSession, publicUser, requireAuth } from '../lib/auth.js';
import { hasCustomMailer } from '../lib/mailer.js';
import {
  issuePasswordReset,
  resetPasswordWithToken,
  secondsUntilPasswordResetResend,
} from '../lib/passwordReset.js';
import {
  buildMetadataPatch,
  isCanonicalCustomerNumber,
  normalizePhone,
  readProfileFields,
  validateAccountFields,
  validateCompanyFields,
  validatePassword,
} from '../lib/profile.js';
import { DEFAULT_ROLE, isAdmin } from '../lib/roles.js';
import { supabase, supabaseAuth } from '../lib/supabase.js';
import { allocateCustomerNumber, createUserSession, ensureUserRole, finalizeOAuthUser, findUserByEmail, isEmailVerified, isSupportedOAuthUser, revokeSession } from '../lib/users.js';
import { issueVerificationCode, secondsUntilResend, verifyUserCode, verifyUserToken } from '../lib/verification.js';

const router = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireSupabase(_req, res, next) {
  if (!supabase || !supabaseAuth) {
    return res.status(503).json({ error: 'Datenbankverbindung ist nicht konfiguriert.' });
  }
  next();
}

function verificationResponse(email) {
  return {
    email,
    requiresVerification: true,
    message: 'Wir haben Ihnen einen Bestätigungscode per E-Mail gesendet.',
  };
}

router.use(requireSupabase);

router.post('/register', async (req, res) => {
  const firstName = String(req.body?.firstName ?? '').trim();
  const lastName = String(req.body?.lastName ?? '').trim();
  const legacyFullName = String(req.body?.fullName ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const resolvedFirst = firstName || legacyFullName.split(/\s+/)[0] || '';
  const resolvedLast = lastName || legacyFullName.split(/\s+/).slice(1).join(' ') || '';
  const fullName = `${resolvedFirst} ${resolvedLast}`.trim() || legacyFullName;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }
  const accountErrors = validateAccountFields({
    firstName: resolvedFirst,
    lastName: resolvedLast,
    requirePhone: false,
  });
  if (accountErrors.length) {
    return res.status(400).json({ error: accountErrors[0] });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      if (isEmailVerified(existing)) {
        return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });
      }
      try {
        await issueVerificationCode(existing);
      } catch (error) {
        if (error.code === 'cooldown') {
          return res.status(201).json(verificationResponse(email));
        }
        console.error('Verification email resend failed:', error.message);
        return res.status(400).json({ error: mapAuthError(error) });
      }
      return res.status(201).json(verificationResponse(email));
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        first_name: resolvedFirst,
        last_name: resolvedLast,
        full_name: fullName,
        email_verified: false,
        onboarding_complete: false,
      },
      app_metadata: { role: DEFAULT_ROLE },
    });

    if (error) {
      const status = /already/i.test(error.message) ? 409 : 400;
      console.error('createUser failed:', error.message);
      return res.status(status).json({ error: mapAuthError(error) });
    }

    if (!data.user) {
      return res.status(400).json({ error: 'Konto konnte nicht erstellt werden.' });
    }

    try {
      await issueVerificationCode(data.user, { ignoreCooldown: true });
    } catch (sendError) {
      console.error('Verification email failed:', sendError.message);
      return res.status(400).json({ error: mapAuthError(sendError) });
    }

    return res.status(201).json(verificationResponse(email));
  } catch (error) {
    console.error('Register failed:', error);
    return res.status(500).json({ error: mapAuthError(error) });
  }
});

async function respondVerified(res, user) {
  const signedIn = await createUserSession(user);
  if (signedIn?.session) {
    const nextUser = await ensureUserRole(signedIn.user || user);
    return res.json({
      ok: true,
      verified: true,
      ...publicSession(signedIn.session, nextUser),
    });
  }

  return res.json({
    ok: true,
    verified: true,
  });
}

router.post('/verify-email', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const code = String(req.body?.code ?? '').trim();
  const token = String(req.body?.token ?? req.body?.token_hash ?? '').trim();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  }
  if (!code && !token) {
    return res.status(400).json({ error: 'Bitte geben Sie den Bestätigungscode ein oder nutzen Sie den Link aus der E-Mail.' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(400).json({ error: 'Der Bestätigungslink oder Code ist ungültig oder abgelaufen.' });
  }
  if (isEmailVerified(user)) {
    return respondVerified(res, user);
  }

  let verifiedUser;
  try {
    verifiedUser = token ? await verifyUserToken(user, token) : await verifyUserCode(user, code);
  } catch (error) {
    const status = error.code === 'locked' ? 429 : 400;
    return res.status(status).json({ error: error.message || mapAuthError(error) });
  }

  return respondVerified(res, verifiedUser || user);
});

router.post('/resend-verification', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  }

  const user = await findUserByEmail(email);
  if (!user || isEmailVerified(user)) {
    return res.json({
      ok: true,
      message: 'Wenn ein unbestätigtes Konto existiert, senden wir einen neuen Code.',
    });
  }

  try {
    await issueVerificationCode(user);
  } catch (error) {
    if (error.code === 'cooldown') {
      return res.status(429).json({
        error: error.message,
        retryAfter: error.retryAfter || secondsUntilResend(user),
      });
    }
    console.error('Resend verification failed:', error.message);
    return res.status(400).json({ error: mapAuthError(error) });
  }

  res.json({
    ok: true,
    message: 'Ein neuer Bestätigungscode wurde gesendet.',
  });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }

  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    if (/email not confirmed/i.test(error?.message || '')) {
      return res.status(403).json({
        error: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.',
        requiresVerification: true,
        email,
      });
    }
    return res.status(401).json({ error: mapAuthError(error || { message: 'invalid login credentials' }) });
  }

  if (!isEmailVerified(data.user)) {
    await revokeSession(data.session.access_token);
    return res.status(403).json({
      error: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.',
      requiresVerification: true,
      email,
    });
  }

  const user = await ensureUserRole(data.user);
  res.json(publicSession(data.session, user));
});

router.post('/oauth', async (req, res) => {
  const token = getBearerToken(req) || String(req.body?.access_token ?? '').trim();
  const refreshToken = String(req.body?.refresh_token ?? '').trim();
  const expiresAt = Number(req.body?.expires_at) || undefined;

  if (!token) {
    return res.status(400).json({ error: 'Anmeldung ist fehlgeschlagen.' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Anmeldung ist fehlgeschlagen.' });
  }

  if (!isSupportedOAuthUser(data.user)) {
    return res.status(400).json({ error: 'Kein Google- oder Apple-Konto gefunden.' });
  }

  try {
    const user = await finalizeOAuthUser(data.user);
    res.json(publicSession({
      access_token: token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    }, user));
  } catch (oauthError) {
    console.error('OAuth complete failed:', oauthError.message);
    return res.status(400).json({ error: mapAuthError(oauthError) });
  }
});

router.post('/logout', async (req, res) => {
  await revokeSession(getBearerToken(req));
  res.json({ ok: true });
});

router.put('/profile', requireAuth, async (req, res) => {
  const password = String(req.body?.password ?? '');
  const completeOnboarding = req.body?.completeOnboarding === true;
  const existing = req.authUser.user_metadata || {};
  const current = readProfileFields(existing, req.authUser.email);

  const firstName = String(req.body?.firstName ?? current.firstName).trim();
  const lastName = String(req.body?.lastName ?? current.lastName).trim();
  const phone = normalizePhone(req.body?.phone ?? current.phone);
  const adminUser = isAdmin(req.authUser);

  const accountErrors = validateAccountFields({
    firstName,
    lastName,
    phone,
    requirePhone: !adminUser,
  });
  if (accountErrors.length) {
    return res.status(400).json({ error: accountErrors[0] });
  }

  const companyPayload = {
    company: req.body?.company ?? current.company,
    legalForm: req.body?.legalForm ?? current.legalForm,
    businessStreet: req.body?.businessStreet
      ?? req.body?.businessAddress?.street
      ?? current.businessAddress.street,
    businessZip: req.body?.businessZip
      ?? req.body?.businessAddress?.zip
      ?? current.businessAddress.zip,
    businessCity: req.body?.businessCity
      ?? req.body?.businessAddress?.city
      ?? current.businessAddress.city,
    billingSame: req.body?.billingSame ?? current.billingSame,
    billingStreet: req.body?.billingStreet
      ?? req.body?.billingAddress?.street
      ?? current.billingAddress.street,
    billingZip: req.body?.billingZip
      ?? req.body?.billingAddress?.zip
      ?? current.billingAddress.zip,
    billingCity: req.body?.billingCity
      ?? req.body?.billingAddress?.city
      ?? current.billingAddress.city,
    website: req.body?.website ?? current.website,
    avatarUrl: req.body?.avatarUrl === undefined ? current.avatarUrl : req.body.avatarUrl,
    firstName,
    lastName,
    phone,
  };

  const companyTouched = completeOnboarding
    || req.body?.company !== undefined
    || req.body?.legalForm !== undefined
    || req.body?.businessStreet !== undefined
    || req.body?.businessZip !== undefined
    || req.body?.businessCity !== undefined;
  const companyErrors = validateCompanyFields(companyPayload);
  const companyReady = companyErrors.length === 0;
  const personalReady = validateAccountFields({
    firstName,
    lastName,
    phone,
    requirePhone: !adminUser,
  }).length === 0;
  const stammdatenReady = companyReady && personalReady;

  if (companyTouched && !companyReady && !adminUser) {
    return res.status(400).json({ error: companyErrors[0] });
  }

  if (password) {
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }
  }

  const markOnboardingComplete = adminUser || stammdatenReady || existing.onboarding_complete === true;
  const needsCustomerNumber = !adminUser
    && markOnboardingComplete
    && !isCanonicalCustomerNumber(existing.customer_number);

  const updates = {
    user_metadata: buildMetadataPatch(existing, companyPayload, {
      completeOnboarding: markOnboardingComplete,
      customerNumber: needsCustomerNumber ? await allocateCustomerNumber() : '',
    }),
  };
  if (password) updates.password = password;

  const { data, error } = await supabase.auth.admin.updateUserById(req.authUser.id, updates);

  if (error || !data.user) {
    console.error('Update profile failed:', error?.message);
    return res.status(400).json({ error: 'Profil konnte nicht gespeichert werden.' });
  }

  res.json({ user: publicUser(data.user) });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? '');
  const password = String(req.body?.password ?? '');
  const email = String(req.authUser.email || '').trim().toLowerCase();

  if (!currentPassword || !password) {
    return res.status(400).json({ error: 'Aktuelles und neues Passwort sind erforderlich.' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  if (currentPassword === password) {
    return res.status(400).json({ error: 'Das neue Passwort muss sich vom aktuellen unterscheiden.' });
  }

  const { error: verifyError } = await supabaseAuth.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verifyError) {
    return res.status(400).json({ error: 'Aktuelles Passwort ist nicht korrekt.' });
  }

  const { data, error } = await supabase.auth.admin.updateUserById(req.authUser.id, { password });

  if (error || !data.user) {
    console.error('Change password failed:', error?.message);
    return res.status(400).json({ error: 'Passwort konnte nicht geändert werden.' });
  }

  res.json({ ok: true, user: publicUser(data.user) });
});

router.get('/me', async (req, res) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user || !isEmailVerified(data.user)) {
    return res.status(401).json({ error: 'Sitzung ungültig oder abgelaufen.' });
  }

  const user = await ensureUserRole(data.user);
  res.json({ user: publicUser(user) });
});

router.post('/refresh', async (req, res) => {
  const refreshToken = String(req.body?.refresh_token ?? '').trim();

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh-Token fehlt.' });
  }

  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session || !data.user || !isEmailVerified(data.user)) {
    return res.status(401).json({ error: 'Sitzung konnte nicht erneuert werden.' });
  }

  const user = await ensureUserRole(data.user);
  res.json(publicSession(data.session, user));
});

router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  }

  const generic = {
    ok: true,
    email,
    message: 'Wenn ein Konto mit dieser E-Mail existiert, senden wir einen Link zum Zurücksetzen.',
  };

  if (!hasCustomMailer()) {
    return res.status(503).json({
      error: 'E-Mail-Versand ist nicht konfiguriert. Bitte RESEND_API_KEY und EMAIL_FROM setzen.',
    });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.json(generic);
    }

    try {
      await issuePasswordReset(user);
    } catch (error) {
      if (error.code === 'cooldown') {
        return res.json({
          ...generic,
          retryAfter: error.retryAfter || secondsUntilPasswordResetResend(user),
        });
      }
      throw error;
    }

    return res.json(generic);
  } catch (error) {
    console.error('Forgot password failed:', error.message);
    return res.status(400).json({ error: mapAuthError(error) });
  }
});

router.post('/reset-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const token = String(req.body?.token ?? req.body?.confirm ?? '').trim();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
  }
  const resetPasswordError = validatePassword(password);
  if (resetPasswordError) {
    return res.status(400).json({ error: resetPasswordError });
  }
  if (!token) {
    return res.status(400).json({
      error: 'Bitte öffnen Sie den Link aus der E-Mail, um Ihr Passwort zurückzusetzen.',
    });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Der Link ist ungültig oder abgelaufen.' });
    }

    await resetPasswordWithToken(user, token, password);

    return res.json({
      ok: true,
      message: 'Ihr Passwort wurde aktualisiert. Bitte melden Sie sich an.',
    });
  } catch (error) {
    console.error('Reset password failed:', error.message);
    return res.status(400).json({ error: mapAuthError(error) });
  }
});

router.post('/resend-password-reset', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  }

  const generic = {
    ok: true,
    email,
    message: 'Wenn ein Konto mit dieser E-Mail existiert, senden wir einen neuen Link.',
  };

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.json(generic);
    }

    try {
      await issuePasswordReset(user);
    } catch (error) {
      if (error.code === 'cooldown') {
        return res.status(429).json({
          error: error.message,
          retryAfter: error.retryAfter || secondsUntilPasswordResetResend(user),
        });
      }
      throw error;
    }

    return res.json(generic);
  } catch (error) {
    console.error('Resend password reset failed:', error.message);
    return res.status(400).json({ error: mapAuthError(error) });
  }
});

export default router;
