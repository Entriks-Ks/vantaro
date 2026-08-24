import { supabase, supabaseAuth, supabaseConfig } from './supabase.js';
import { ROLES, getUserRole } from './roles.js';

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

export async function createUserSession(user) {
  const email = user?.email;
  if (!email || !supabase || !supabaseAuth) return null;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error) {
    console.error('createUserSession generateLink failed:', error.message);
    return null;
  }

  const hashedToken = data?.properties?.hashed_token;
  const emailOtp = data?.properties?.email_otp;
  let result = null;

  if (hashedToken) {
    result = await supabaseAuth.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    });
  }

  if ((!result?.data?.session) && emailOtp) {
    result = await supabaseAuth.auth.verifyOtp({
      email,
      token: emailOtp,
      type: 'email',
    });
  }

  if (result?.error || !result?.data?.session) {
    console.error('createUserSession verifyOtp failed:', result?.error?.message || 'no session');
    return null;
  }

  return result.data;
}

export async function ensureUserRole(user) {
  if (!user?.id) return user;

  const role = getUserRole(user);
  if (user.app_metadata?.role === role) return user;

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      role,
    },
  });

  if (error) {
    console.error('ensureUserRole failed:', error.message);
    return user;
  }

  return data.user || user;
}

export function toDirectoryUser(user) {
  const metadata = user.user_metadata || {};
  const fullName = metadata.full_name
    || `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim();

  return {
    id: user.id,
    email: user.email,
    fullName,
    company: metadata.company || '',
    customerNumber: metadata.customer_number || '',
    phone: metadata.phone || '',
    role: getUserRole(user),
    verified: isEmailVerified(user),
    onboardingComplete: metadata.onboarding_complete === true,
    createdAt: user.created_at || null,
  };
}

export async function listDirectoryUsers() {
  const users = [];

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('listDirectoryUsers failed:', error.message);
      break;
    }

    users.push(...(data.users || []));
    if ((data.users || []).length < 200) break;
  }

  const mapped = users
    .map(toDirectoryUser)
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

  return {
    counts: {
      total: mapped.length,
      berater: mapped.filter((user) => user.role === ROLES.BERATER).length,
      admin: mapped.filter((user) => user.role === ROLES.ADMIN).length,
      unverified: mapped.filter((user) => !user.verified).length,
    },
    recent: mapped.slice(0, 8),
    users: mapped,
  };
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
