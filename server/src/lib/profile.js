import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const LEGAL_FORMS = [
  'GmbH',
  'UG (haftungsbeschränkt)',
  'AG',
  'e.K.',
  'GbR',
  'OHG',
  'KG',
  'PartG',
  'Freiberufler / Einzelunternehmen',
  'Sonstige',
];

const DEFAULT_PHONE_COUNTRY = 'DE';
const AVATAR_MAX_CHARS = 120_000;

function trim(value) {
  return String(value ?? '').trim();
}

export function buildFullName(firstName, lastName, fallback = '') {
  const combined = `${trim(firstName)} ${trim(lastName)}`.trim();
  return combined || trim(fallback);
}

export function splitFullName(fullName) {
  const parts = trim(fullName).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** Normalize to E.164 (+49… for DE). Never stores bare 49 without +. */
export function normalizePhone(value, defaultCountry = DEFAULT_PHONE_COUNTRY) {
  const raw = trim(value);
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');

  // ITU-T E.164 max is 15 digits; reject anything longer immediately.
  if (digits.length > 15) return '';

  let candidate = raw;
  let countryHint = defaultCountry;

  if (raw.startsWith('+')) {
    candidate = `+${digits}`;
    countryHint = undefined;
  } else if (/^00\d/.test(digits)) {
    candidate = `+${digits.slice(2)}`;
    countryHint = undefined;
  } else if (digits.startsWith('49') && digits.length >= 11) {
    // "49176…" without plus → country code, not a national number
    candidate = `+${digits}`;
    countryHint = undefined;
  } else {
    candidate = digits || raw;
  }

  const parsed = parsePhoneNumberFromString(candidate, countryHint);
  if (parsed?.isValid()) {
    return parsed.format('E.164');
  }

  return '';
}

export function isValidPhone(value, defaultCountry = DEFAULT_PHONE_COUNTRY) {
  return Boolean(normalizePhone(value, defaultCountry));
}

export function isValidWebsite(value) {
  const raw = trim(value);
  if (!raw) return true;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    return Boolean(url.hostname.includes('.'));
  } catch {
    return false;
  }
}

export function normalizeWebsite(value) {
  const raw = trim(value);
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

const CUSTOMER_NUMBER_START = 100001;
const CUSTOMER_NUMBER_PATTERN = /^VAN-\d{6,}$/;

export function formatCustomerNumber(sequence) {
  const value = Number(sequence);
  const next = Number.isFinite(value) && value >= CUSTOMER_NUMBER_START
    ? Math.floor(value)
    : CUSTOMER_NUMBER_START;
  return `VAN-${String(next).padStart(6, '0')}`;
}

export function parseCustomerSequence(value) {
  const match = String(value || '').trim().toUpperCase().match(/^VAN-(\d{6,})$/);
  return match ? Number(match[1]) : 0;
}

export function isCanonicalCustomerNumber(value) {
  return CUSTOMER_NUMBER_PATTERN.test(String(value || '').trim().toUpperCase())
    && parseCustomerSequence(value) >= CUSTOMER_NUMBER_START;
}

export function nextCustomerNumber(existingNumbers = []) {
  const max = (existingNumbers || []).reduce((highest, value) => {
    const sequence = parseCustomerSequence(value);
    return sequence > highest ? sequence : highest;
  }, CUSTOMER_NUMBER_START - 1);
  return formatCustomerNumber(max + 1);
}

export function generateCustomerNumber(existingNumbers = []) {
  return nextCustomerNumber(existingNumbers);
}

export function readProfileFields(metadata = {}, email = '') {
  const legacyName = trim(metadata.full_name);
  const split = splitFullName(legacyName);
  const firstName = trim(metadata.first_name) || split.firstName;
  const lastName = trim(metadata.last_name) || split.lastName;
  const fullName = buildFullName(firstName, lastName, legacyName);
  const billingSame = metadata.billing_same !== false;
  const radiusKm = Number(metadata.radius_km);
  const products = Array.isArray(metadata.products)
    ? metadata.products
    : String(metadata.products || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  const business = {
    street: trim(metadata.business_street),
    zip: trim(metadata.business_zip),
    city: trim(metadata.business_city),
  };

  const billing = billingSame
    ? { ...business }
    : {
        street: trim(metadata.billing_street),
        zip: trim(metadata.billing_zip),
        city: trim(metadata.billing_city),
      };

  return {
    firstName,
    lastName,
    fullName,
    phone: trim(metadata.phone),
    avatarUrl: trim(metadata.avatar_url),
    company: trim(metadata.company),
    legalForm: trim(metadata.legal_form),
    businessAddress: business,
    billingAddress: billing,
    billingSame,
    website: trim(metadata.website),
    customerNumber: trim(metadata.customer_number),
    location: trim(metadata.location) || business.city,
    radiusKm: Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 10,
    products: products.length ? products : ['PKV', 'bAV', 'BU'],
    email: trim(email),
    settings: normalizeUserSettings(metadata.settings),
  };
}

const APPEARANCES = new Set(['dark', 'light', 'device']);

export function normalizeAppearance(value) {
  return APPEARANCES.has(value) ? value : 'dark';
}

export function normalizeUserSettings(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    toastAlerts: src.toastAlerts !== false,
    browserAlerts: src.browserAlerts === true,
    emailReminders: src.emailReminders !== false,
    googleCalendar: src.googleCalendar !== false,
    terminAlerts: src.terminAlerts !== false,
    wiedervorlageAlerts: src.wiedervorlageAlerts !== false,
    appearance: normalizeAppearance(src.appearance),
  };
}

export function hasCompletedOnboarding(metadata = {}) {
  if (metadata.onboarding_complete === true) return true;
  const profile = readProfileFields(metadata);
  return Boolean(
    profile.company
    && profile.legalForm
    && profile.businessAddress.street
    && profile.businessAddress.zip
    && profile.businessAddress.city
    && profile.phone
    && (profile.firstName || profile.lastName || profile.fullName),
  );
}

export function validateAccountFields({ firstName, lastName, phone, requirePhone = true }) {
  const errors = [];
  if (!trim(firstName) || trim(firstName).length < 2) {
    errors.push('Bitte geben Sie Ihren Vornamen an.');
  }
  if (!trim(lastName) || trim(lastName).length < 2) {
    errors.push('Bitte geben Sie Ihren Nachnamen an.');
  }
  if (phone) {
    if (!isValidPhone(phone)) {
      errors.push('Bitte geben Sie eine gültige Telefonnummer an.');
    }
  } else if (requirePhone) {
    errors.push('Bitte geben Sie eine gültige Telefonnummer an.');
  }
  return errors;
}

export function validatePassword(password) {
  const value = String(password ?? '');
  if (value.length < 8) {
    return 'Passwort muss mindestens 8 Zeichen lang sein.';
  }
  if (!/[a-zäöüß]/.test(value)) {
    return 'Passwort muss mindestens einen Kleinbuchstaben enthalten.';
  }
  if (!/[A-ZÄÖÜ]/.test(value)) {
    return 'Passwort muss mindestens einen Großbuchstaben enthalten.';
  }
  if (!/\d/.test(value)) {
    return 'Passwort muss mindestens eine Zahl enthalten.';
  }
  if (!/[!@$%#?&*_\-+=.^]/.test(value)) {
    return 'Passwort muss mindestens ein Sonderzeichen enthalten (!@$%#?&*_-+.=^).';
  }
  return '';
}

export function generatePassword(length = 14) {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@$%#?&*_-+.=^';
  const all = lower + upper + digits + special;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [pick(lower), pick(upper), pick(digits), pick(special)];
  while (chars.length < Math.max(12, length)) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function validateCompanyFields(payload) {
  const errors = [];
  if (!trim(payload.company)) errors.push('Bitte geben Sie den Firmennamen an.');
  if (!trim(payload.legalForm) || !LEGAL_FORMS.includes(trim(payload.legalForm))) {
    errors.push('Bitte wählen Sie eine gültige Rechtsform.');
  }
  if (!trim(payload.businessStreet)) errors.push('Bitte geben Sie die Geschäftsadresse an.');
  if (!trim(payload.businessZip)) errors.push('Bitte geben Sie die PLZ an.');
  if (!trim(payload.businessCity)) errors.push('Bitte geben Sie den Ort an.');

  const billingSame = payload.billingSame !== false;
  if (!billingSame) {
    if (!trim(payload.billingStreet)) errors.push('Bitte geben Sie die Rechnungsadresse an.');
    if (!trim(payload.billingZip)) errors.push('Bitte geben Sie die PLZ der Rechnungsadresse an.');
    if (!trim(payload.billingCity)) errors.push('Bitte geben Sie den Ort der Rechnungsadresse an.');
  }

  if (!isValidWebsite(payload.website)) {
    errors.push('Bitte geben Sie eine gültige Website-URL an.');
  }

  if (payload.avatarUrl && String(payload.avatarUrl).length > AVATAR_MAX_CHARS) {
    errors.push('Das Profilbild ist zu groß. Bitte wählen Sie ein kleineres Bild.');
  }

  return errors;
}

export function buildMetadataPatch(existing = {}, payload = {}, {
  completeOnboarding = false,
  customerNumber: assignedCustomerNumber = '',
} = {}) {
  const firstName = trim(payload.firstName ?? existing.first_name);
  const lastName = trim(payload.lastName ?? existing.last_name);
  const fullName = buildFullName(firstName, lastName, existing.full_name);
  const phone = normalizePhone(payload.phone ?? existing.phone);
  const billingSame = payload.billingSame !== undefined
    ? Boolean(payload.billingSame)
    : existing.billing_same !== false;

  const businessStreet = trim(payload.businessStreet ?? existing.business_street);
  const businessZip = trim(payload.businessZip ?? existing.business_zip);
  const businessCity = trim(payload.businessCity ?? existing.business_city);

  const billingStreet = billingSame
    ? businessStreet
    : trim(payload.billingStreet ?? existing.billing_street);
  const billingZip = billingSame
    ? businessZip
    : trim(payload.billingZip ?? existing.billing_zip);
  const billingCity = billingSame
    ? businessCity
    : trim(payload.billingCity ?? existing.billing_city);

  let customerNumber = trim(existing.customer_number);
  if (!isCanonicalCustomerNumber(customerNumber)) {
    customerNumber = completeOnboarding ? trim(assignedCustomerNumber) : '';
  }

  const avatarUrl = payload.avatarUrl === undefined
    ? trim(existing.avatar_url)
    : trim(payload.avatarUrl);

  return {
    ...existing,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    phone,
    avatar_url: avatarUrl,
    company: trim(payload.company ?? existing.company),
    legal_form: trim(payload.legalForm ?? existing.legal_form),
    business_street: businessStreet,
    business_zip: businessZip,
    business_city: businessCity,
    billing_same: billingSame,
    billing_street: billingStreet,
    billing_zip: billingZip,
    billing_city: billingCity,
    website: normalizeWebsite(payload.website ?? existing.website),
    customer_number: customerNumber,
    location: businessCity || trim(existing.location),
    onboarding_complete: completeOnboarding
      ? true
      : existing.onboarding_complete === true,
    settings: normalizeUserSettings(
      payload.settings !== undefined ? payload.settings : existing.settings,
    ),
  };
}
