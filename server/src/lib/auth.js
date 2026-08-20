export function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || '',
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
