function trim(value) {
  return String(value || '').trim();
}

function parseIntList(value) {
  return trim(value)
    .split(/[,;\s]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function parseStringList(value, allowed) {
  const items = trim(value)
    .split(/[,;\s]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (!allowed) return items;
  return items.filter((item) => allowed.includes(item));
}

const CALL_STATUS_GROUPS = ['SALE', 'CALLBACK', 'CONTACT', 'NOCONTACT'];

export function getTcDialConfig() {
  const apiBaseUrl = trim(process.env.TCDIAL_API_BASE_URL).replace(/\/+$/, '');
  const apiKey = trim(process.env.TCDIAL_API_KEY);
  const webhookPublicKey = trim(process.env.TCDIAL_WEBHOOK_PUBLIC_KEY);
  const webhookUrl = trim(process.env.TCDIAL_WEBHOOK_URL);
  const skipVerify = /^(1|true|yes)$/i.test(trim(process.env.TCDIAL_WEBHOOK_SKIP_VERIFY));
  const callStatusGroups = parseStringList(
    process.env.TCDIAL_CALL_STATUS_GROUPS || 'SALE',
    CALL_STATUS_GROUPS,
  );
  const callStatuses = parseIntList(process.env.TCDIAL_CALL_STATUS_IDS);
  const campaigns = parseIntList(process.env.TCDIAL_CAMPAIGN_IDS);

  return {
    apiBaseUrl,
    apiKey,
    webhookPublicKey,
    webhookUrl,
    skipVerify,
    callStatusGroups,
    callStatuses,
    campaigns,
    configured: Boolean(apiBaseUrl && apiKey),
    webhookConfigured: Boolean(webhookPublicKey) || skipVerify,
  };
}
