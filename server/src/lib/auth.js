import { supabase } from './supabase.js';
import { hasCompletedOnboarding, readProfileFields } from './profile.js';
import { getUserRole } from './roles.js';
import { ensureUserRole, isEmailVerified } from './users.js';

export function publicUser(user) {
  if (!user) return null;

  const metadata = user.user_metadata || {};
  const profile = readProfileFields(metadata, user.email);

  return {
    id: user.id,
    email: user.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: profile.fullName,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    role: getUserRole(user),
    onboardingComplete: hasCompletedOnboarding(metadata),
    customerNumber: profile.customerNumber,
    profile: {
      company: profile.company,
      legalForm: profile.legalForm,
      businessAddress: profile.businessAddress,
      billingAddress: profile.billingAddress,
      billingSame: profile.billingSame,
      website: profile.website,
      location: profile.location,
      radiusKm: profile.radiusKm,
      products: profile.products,
    },
  };
}

export function publicSession(session, user) {
  if (!session) return null;

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: publicUser(user || session.user),
  };
}

export function mapAuthError(error) {
  const message = error?.message || '';

  if (/invalid login credentials/i.test(message)) {
    return 'E-Mail oder Passwort ist ungültig.';
  }
  if (/already registered/i.test(message) || /user already exists/i.test(message)) {
    return 'Diese E-Mail-Adresse ist bereits registriert.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.';
  }
  if (/invalid email/i.test(message)) {
    return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  }
  if (/password/i.test(message) && /(?:6|8|least|characters)/i.test(message)) {
    return 'Passwort muss mindestens 8 Zeichen lang sein.';
  }
  if (/rate limit/i.test(message) || /too many/i.test(message)) {
    return 'Zu viele Versuche. Bitte warten Sie einen Moment.';
  }
  if (/resend error|EMAIL_FROM|RESEND_API_KEY|domain is not verified|invalid `from`/i.test(message)) {
    return 'Die Bestätigungs-E-Mail konnte nicht gesendet werden. Prüfen Sie RESEND_API_KEY und EMAIL_FROM (verifizierte Domain).';
  }

  console.error('Auth error:', message);
  return 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.';
}

export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return null;
  return token;
}

export async function requireAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user || !isEmailVerified(data.user)) {
      return res.status(401).json({ error: 'Sitzung ungültig oder abgelaufen.' });
    }

    const user = await ensureUserRole(data.user);
    req.authUser = user;
    req.user = publicUser(user);
    next();
  } catch (error) {
    console.error('requireAuth failed:', error.message);
    return res.status(401).json({ error: 'Sitzung ungültig oder abgelaufen.' });
  }
}

export function requireRole(...roles) {
  const allowed = roles.map((role) => String(role).toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht angemeldet.' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    next();
  };
}
