import { L } from './i18n';

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

const AVATAR_MAX_SIDE = 192;
const AVATAR_QUALITY = 0.65;

export function formatAddress(address) {
  if (!address) return '';
  const street = String(address.street || '').trim();
  const zip = String(address.zip || '').trim();
  const city = String(address.city || '').trim();
  return [street, `${zip} ${city}`.trim()].filter(Boolean).join(', ');
}

export function validatePassword(password) {
  const value = String(password ?? '');
  if (value.length < 8) {
    return L('Passwort muss mindestens 8 Zeichen lang sein.', 'Password must be at least 8 characters long.');
  }
  if (!/[a-zäöüß]/.test(value)) {
    return L('Passwort muss mindestens einen Kleinbuchstaben enthalten.', 'Password must contain at least one lowercase letter.');
  }
  if (!/[A-ZÄÖÜ]/.test(value)) {
    return L('Passwort muss mindestens einen Großbuchstaben enthalten.', 'Password must contain at least one uppercase letter.');
  }
  if (!/\d/.test(value)) {
    return L('Passwort muss mindestens eine Zahl enthalten.', 'Password must contain at least one number.');
  }
  if (!/[!@$%#?&*_\-+=.^]/.test(value)) {
    return L('Passwort muss mindestens ein Sonderzeichen enthalten (!@$%#?&*_-+.=^).', 'Password must contain at least one special character (!@$%#?&*_-+.=^).');
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

export function passwordRules(password) {
  const value = String(password ?? '');
  return [
    { id: 'length', label: L('Mindestens 8 Zeichen', 'At least 8 characters'), ok: value.length >= 8 },
    { id: 'lower', label: L('Kleinbuchstabe', 'Lowercase letter'), ok: /[a-zäöüß]/.test(value) },
    { id: 'upper', label: L('Großbuchstabe', 'Uppercase letter'), ok: /[A-ZÄÖÜ]/.test(value) },
    { id: 'digit', label: L('Zahl', 'Number'), ok: /\d/.test(value) },
    { id: 'special', label: L('Sonderzeichen (!@$%#…)', 'Special character (!@$%#…)'), ok: /[!@$%#?&*_\-+=.^]/.test(value) },
  ];
}

export function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    if (!file.type?.startsWith('image/')) {
      reject(new Error(L('Bitte wählen Sie eine Bilddatei.', 'Please choose an image file.')));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error(L('Profilbild konnte nicht gelesen werden.', 'Profile picture could not be read.')));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error(L('Profilbild ist ungültig.', 'Profile picture is invalid.')));
      image.onload = () => {
        const scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', AVATAR_QUALITY));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
