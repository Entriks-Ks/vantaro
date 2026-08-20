import { supabase, supabaseConfig } from './supabase.js';

export async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !supabaseConfig.configured) return null;

  try {
    const response = await fetch(
      `${supabaseConfig.url}/auth/v1/admin/users?page=1&per_page=200`,
      {
        headers: {
          apikey: supabaseConfig.serviceRoleKey,
          Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        },
      },
    );

    if (response.ok) {
      const payload = await response.json();
      const users = payload.users || payload;
      if (Array.isArray(users)) {
        const match = users.find((user) => user.email?.toLowerCase() === normalized);
        if (match) return match;
      }
    }

    return findUserByEmailPaged(normalized);
  } catch (error) {
    console.error('findUserByEmail failed:', error.message);
    return null;
  }
}

async function findUserByEmailPaged(normalized) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('listUsers failed:', error.message);
      return null;
    }
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

export function isEmailVerified(user) {
  return user?.user_metadata?.email_verified === true;
}

export async function revokeSession(accessToken) {
  if (!accessToken || !supabaseConfig.url) return;

  await fetch(`${supabaseConfig.url}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      apikey: supabaseConfig.serviceRoleKey || supabaseConfig.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => {});
}
