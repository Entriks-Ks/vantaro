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
