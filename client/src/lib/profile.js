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

export function passwordRules(password) {
  const value = String(password ?? '');
  return [
    { id: 'length', label: 'Mindestens 8 Zeichen', ok: value.length >= 8 },
    { id: 'lower', label: 'Kleinbuchstabe', ok: /[a-zäöüß]/.test(value) },
    { id: 'upper', label: 'Großbuchstabe', ok: /[A-ZÄÖÜ]/.test(value) },
    { id: 'digit', label: 'Zahl', ok: /\d/.test(value) },
    { id: 'special', label: 'Sonderzeichen (!@$%#…)', ok: /[!@$%#?&*_\-+=.^]/.test(value) },
  ];
}

export function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    if (!file.type?.startsWith('image/')) {
      reject(new Error('Bitte wählen Sie eine Bilddatei.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Profilbild konnte nicht gelesen werden.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Profilbild ist ungültig.'));
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
