import { Router } from 'express';
import { getBearerToken, mapAuthError, publicSession, publicUser, requireAuth } from '../lib/auth.js';
import { getClientOrigin } from '../lib/clientOrigin.js';
import { DEFAULT_ROLE } from '../lib/roles.js';
import { supabase, supabaseAuth } from '../lib/supabase.js';
import { createUserSession, ensureUserRole, findUserByEmail, isEmailVerified, revokeSession } from '../lib/users.js';
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
  const fullName = String(req.body?.fullName ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich.' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
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
      user_metadata: { full_name: fullName, email_verified: false },
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

router.post('/logout', async (req, res) => {
  await revokeSession(getBearerToken(req));
  res.json({ ok: true });
});

router.put('/profile', requireAuth, async (req, res) => {
  const fullName = String(req.body?.fullName ?? req.authUser.user_metadata?.full_name ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (!fullName || fullName.length < 2) {
    return res.status(400).json({ error: 'Bitte geben Sie Ihren Namen an.' });
  }
  if (password && password.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
  }

  const updates = {
    user_metadata: {
      ...(req.authUser.user_metadata || {}),
      full_name: fullName,
    },
  };
  if (password) updates.password = password;

  const { data, error } = await supabase.auth.admin.updateUserById(req.authUser.id, updates);

  if (error || !data.user) {
    console.error('Update profile failed:', error?.message);
    return res.status(400).json({ error: 'Profil konnte nicht gespeichert werden.' });
  }

  res.json({ user: publicUser(data.user) });
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

  const origin = getClientOrigin();
  const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/login`,
  });

  if (error) {
    return res.status(400).json({ error: mapAuthError(error) });
  }

  res.json({
    ok: true,
    message: 'Wenn ein Konto mit dieser E-Mail existiert, senden wir einen Link zum Zurücksetzen.',
  });
});

export default router;
