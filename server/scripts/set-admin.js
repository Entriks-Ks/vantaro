import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/set-admin.js user@email.com');
  process.exit(1);
}

const url = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
if (error) {
  console.error(error.message);
  process.exit(1);
}

const user = (data.users || []).find((entry) => entry.email?.toLowerCase() === email);
if (!user) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}

const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  app_metadata: {
    ...(user.app_metadata || {}),
    role: 'admin',
  },
});

if (updateError) {
  console.error(updateError.message);
  process.exit(1);
}

console.log(`Set ${updated.user.email} to admin`);
