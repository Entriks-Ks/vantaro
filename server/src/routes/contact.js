import { Router } from 'express';
import { sendSupportEmail } from '../lib/mailer.js';

const router = Router();

const CATEGORIES = new Set(['general', 'billing', 'technical', 'leads', 'account', 'calendar']);
const PRIORITIES = new Set(['normal', 'urgent']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ATTACH_MAX = 3;
const ATTACH_BYTES = 1_200_000;
const ATTACH_TYPES = /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/i;
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

function safeFilename(name, index, mime) {
  const cleaned = String(name || '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const base = cleaned || `anhang-${index + 1}`;
  if (/\.(jpe?g|png|webp|gif|pdf)$/i.test(base)) return base;
  return `${base}${MIME_EXT[mime] || ''}`;
}

function parseSupportAttachments(raw) {
  if (raw == null || raw === '') return [];
  if (!Array.isArray(raw)) {
    throw new Error('Anhänge sind ungültig.');
  }
  if (raw.length > ATTACH_MAX) {
    throw new Error('Maximal 3 Dateien.');
  }

  return raw.map((item, index) => {
    const name = clip(item?.name, 120) || `anhang-${index + 1}`;
    const data = String(item?.data || '');
    const match = data.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) {
      throw new Error(`Datei „${name}“ ist ungültig.`);
    }
    const mime = String(item?.type || match[1]).toLowerCase().trim();
    if (!ATTACH_TYPES.test(mime)) {
      throw new Error(`Dateityp von „${name}“ ist nicht erlaubt. Bitte PDF oder Bild (JPG, PNG, WebP).`);
    }
    const content = match[2].replace(/\s/g, '');
    const bytes = Math.floor((content.length * 3) / 4);
    if (bytes > ATTACH_BYTES) {
      throw new Error(`Datei „${name}“ ist zu groß. Maximal 1,2 MB.`);
    }
    const contentType = mime === 'image/jpg' ? 'image/jpeg' : mime;
    const isImage = contentType.startsWith('image/');
    return {
      filename: safeFilename(name, index, contentType),
      content,
      content_type: contentType,
      ...(isImage ? { content_id: `support-file-${index}` } : {}),
    };
  });
}

router.post('/', async (req, res) => {
  try {
    const body = req.body ?? {};
    const name = clip(body.name, 120);
    const email = clip(body.email, 160).toLowerCase();
    const subject = clip(body.subject, 140);
    const message = clip(body.message, 4000);
    const category = CATEGORIES.has(body.category) ? body.category : 'general';
    const priority = PRIORITIES.has(body.priority) ? body.priority : 'normal';

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Bitte füllen Sie alle Pflichtfelder aus.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'E-Mail-Adresse ist ungültig.' });
    }
    if (message.length < 20) {
      return res.status(400).json({ error: 'Bitte beschreiben Sie Ihr Anliegen etwas genauer.' });
    }

    let attachments = [];
    try {
      attachments = parseSupportAttachments(body.attachments);
    } catch (attachError) {
      return res.status(400).json({ error: attachError.message });
    }

    await sendSupportEmail({
      name,
      email,
      category,
      priority,
      subject,
      message,
      phone: clip(body.phone, 40),
      company: clip(body.company, 160),
      customerNumber: clip(body.customerNumber, 40),
      leadRef: clip(body.leadRef, 80),
      userId: clip(body.userId, 80),
      pageUrl: clip(body.pageUrl, 300),
      userAgent: clip(body.userAgent, 240),
      attachments,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Support request error:', error);
    res.status(500).json({ error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' });
  }
});

export default router;
