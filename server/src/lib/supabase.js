import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export const supabaseConfig = {
  url,
  anonKey,
  serviceRoleKey,
  configured: Boolean(url && serviceRoleKey),
};

const authOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export const supabase = supabaseConfig.configured
  ? createClient(url, serviceRoleKey, authOptions)
  : null;

export const supabaseAuth =
  url && (anonKey || serviceRoleKey)
    ? createClient(url, anonKey || serviceRoleKey, authOptions)
    : null;

export async function pingDatabase() {
  if (!supabaseConfig.configured) {
    throw new Error('missing credentials');
  }

  const response = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return { ok: true, clientReady: Boolean(supabase) };
}
