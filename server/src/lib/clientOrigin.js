const DEFAULT_FRONTEND = 'https://www.vantaro.io';

const BUILTIN_ORIGINS = [
  'http://localhost:5176',
  'http://localhost:3000',
  'https://vantaro.io',
  'https://www.vantaro.io',
  'https://vantaro-steel.vercel.app',
];

function parseEnvOrigins(...values) {
  return values
    .flatMap((value) => String(value || '').split(','))
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** All allowed browser origins (hardcoded + FRONTEND_URL / CLIENT_ORIGIN). */
export function getClientOrigins() {
  return [
    ...new Set([
      ...BUILTIN_ORIGINS,
      ...parseEnvOrigins(process.env.FRONTEND_URL, process.env.CLIENT_ORIGIN),
    ]),
  ];
}

/**
 * Primary frontend URL for emails and redirects.
 * Prefer FRONTEND_URL, then CLIENT_ORIGIN, then production www.
 */
export function getClientOrigin() {
  const fromEnv = parseEnvOrigins(process.env.FRONTEND_URL, process.env.CLIENT_ORIGIN)[0];
  return fromEnv || DEFAULT_FRONTEND;
}

/** Public API origin for email links (ICS download). */
export function getApiOrigin() {
  const fromEnv = parseEnvOrigins(
    process.env.API_PUBLIC_URL,
    process.env.PUBLIC_API_URL,
    process.env.RENDER_EXTERNAL_URL,
  )[0];
  if (fromEnv) return fromEnv;
  const port = process.env.PORT || 3001;
  return `http://localhost:${port}`;
}
