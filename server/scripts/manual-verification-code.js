import 'dotenv/config';
import { DEFAULT_ROLE } from '../src/lib/roles.js';
import { supabase } from '../src/lib/supabase.js';
import { findUserByEmail, isEmailVerified } from '../src/lib/users.js';
import { clientOrigin, generateVerificationCode, setManualVerificationCode } from '../src/lib/verification.js';

// Pre-issues an email verification code for one address. Send the printed code
// to the person yourself; they register normally on /register with their own
// name and password, get no verification email, and enter this code instead.
//
// Usage:
//   node scripts/manual-verification-code.js user@example.com [--code=123456] [--days=7]
//
// Running it again for the same (still unverified) address replaces the code.

function fail(message) {
  console.error(message);
  process.exit(1);
}

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const flags = Object.fromEntries(
  process.argv.slice(2)
    .map((arg) => arg.match(/^--([^=]+)=(.*)$/s))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);

const email = String(positional[0] || '').trim().toLowerCase();
const code = String(flags.code || generateVerificationCode()).trim();
const days = Number(flags.days || 7);

if (!supabase) fail('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in server/.env.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail('Usage: node scripts/manual-verification-code.js user@example.com [--code=123456] [--days=7]');
}
if (!/^\d{6}$/.test(code)) fail('--code must be exactly 6 digits.');
if (!Number.isFinite(days) || days <= 0 || days > 30) fail('--days must be between 1 and 30.');

let user = await findUserByEmail(email);
let created = false;

if (user && isEmailVerified(user)) {
  fail(`${email} is already registered and verified. Nothing to do.`);
}

if (!user) {
  // Placeholder account without a password; the person's registration fills it in.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: {
      email_verified: false,
      onboarding_complete: false,
    },
    app_metadata: { role: DEFAULT_ROLE },
  });
  if (error || !data.user) fail(`createUser failed: ${error?.message || 'no user returned'}`);
  user = data.user;
  created = true;
}

let result;
try {
  result = await setManualVerificationCode(user, {
    code,
    ttlMs: days * 24 * 60 * 60 * 1000,
  });
} catch (error) {
  if (created) await supabase.auth.admin.deleteUser(user.id).catch(() => {});
  fail(`Setting the code failed: ${error.message}`);
}

console.log(`Email:             ${email}`);
console.log(`Verification code: ${result.code}`);
console.log(`Valid until:       ${result.expiresAt.toISOString()}`);
console.log(`Register at:       ${clientOrigin()}/register`);
console.log('No email was sent. The person registers with this email, then enters the code.');
