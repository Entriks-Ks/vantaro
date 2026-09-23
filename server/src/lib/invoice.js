const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_RIGHT = PAGE_W - MARGIN;

const INK = [16, 24, 39];
const MUTED = [90, 107, 124];
const LINE = [210, 218, 226];
const HEADER_BG = [241, 245, 249];
const BRAND = [27, 168, 154];
const TEAL = [86, 211, 196];
const CORAL = [255, 117, 90];
const WHITE = [255, 255, 255];

const WIN_ANSI = {
  '\u20AC': 0x80,
  '\u201A': 0x82,
  '\u0192': 0x83,
  '\u201E': 0x84,
  '\u2026': 0x85,
  '\u2020': 0x86,
  '\u2021': 0x87,
  '\u02C6': 0x88,
  '\u2030': 0x89,
  '\u0160': 0x8A,
  '\u2039': 0x8B,
  '\u0152': 0x8C,
  '\u017D': 0x8E,
  '\u2018': 0x91,
  '\u2019': 0x92,
  '\u201C': 0x93,
  '\u201D': 0x94,
  '\u2022': 0x95,
  '\u2013': 0x96,
  '\u2014': 0x97,
  '\u02DC': 0x98,
  '\u2122': 0x99,
  '\u0161': 0x9A,
  '\u203A': 0x9B,
  '\u0153': 0x9C,
  '\u017E': 0x9E,
  '\u0178': 0x9F,
  Ä: 0xC4,
  Ö: 0xD6,
  Ü: 0xDC,
  ß: 0xDF,
  ä: 0xE4,
  ö: 0xF6,
  ü: 0xFC,
};

const WIDTH_HELVETICA = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
  56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556,
  64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
  80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
  88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556,
  96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
  104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556, 111: 556,
  112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556, 118: 500, 119: 722,
  120: 500, 121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584,
  128: 556, 196: 667, 201: 667, 214: 778, 220: 722, 223: 611, 228: 556, 233: 556,
  246: 556, 252: 556,
};

const WIDTH_HELVETICA_BOLD = {
  32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 238,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
  56: 556, 57: 556, 58: 333, 59: 333, 60: 584, 61: 584, 62: 584, 63: 611,
  64: 975, 65: 722, 66: 722, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 778, 73: 389, 74: 500, 75: 778, 76: 667, 77: 944, 78: 722, 79: 778,
  80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 1000,
  88: 722, 89: 722, 90: 611, 91: 333, 92: 278, 93: 333, 94: 584, 95: 556,
  96: 333, 97: 556, 98: 611, 99: 556, 100: 611, 101: 556, 102: 333, 103: 611,
  104: 611, 105: 278, 106: 278, 107: 556, 108: 278, 109: 889, 110: 611, 111: 611,
  112: 611, 113: 611, 114: 389, 115: 556, 116: 333, 117: 611, 118: 556, 119: 778,
  120: 556, 121: 556, 122: 500, 123: 389, 124: 280, 125: 389, 126: 584,
  128: 556, 196: 722, 201: 667, 214: 778, 220: 722, 223: 611, 228: 556, 233: 556,
  246: 611, 252: 611,
};

function pdfByte(char) {
  const mapped = WIN_ANSI[char];
  if (mapped != null) return mapped;
  const code = char.codePointAt(0);
  if (code <= 255) return code;
  return 0x3F;
}

function pdfEscape(value) {
  let out = '';
  for (const char of String(value || '')) {
    const byte = pdfByte(char);
    if (byte === 0x5C) out += '\\\\';
    else if (byte === 0x28) out += '\\(';
    else if (byte === 0x29) out += '\\)';
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

function rgb(r, g, b) {
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`;
}

function strokeRgb(r, g, b) {
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`;
}

function rect(x, y, w, h, fill = true) {
  return `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill ? 'f' : 'S'}`;
}

function line(x1, y1, x2, y2) {
  return `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
}

function triangle(x1, y1, x2, y2, x3, y3) {
  return `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l ${x3.toFixed(2)} ${y3.toFixed(2)} l h f`;
}

function widthsFor(font) {
  return font === 'F2' ? WIDTH_HELVETICA_BOLD : WIDTH_HELVETICA;
}

function stringWidth(value, font = 'F1', size = 10) {
  const table = widthsFor(font);
  let width = 0;
  for (const char of String(value || '')) {
    width += table[pdfByte(char)] || 500;
  }
  return (width * size) / 1000;
}

function text(x, y, value, { font = 'F1', size = 10 } = {}) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(value)}) Tj ET`;
}

function textRight(right, y, value, opts = {}) {
  const width = stringWidth(value, opts.font || 'F1', opts.size || 10);
  return text(right - width, y, value, opts);
}

function wrapText(value, font, size, maxWidth) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (stringWidth(next, font, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function formatEuroDe(cents) {
  const amount = (Number(cents) || 0) / 100;
  const [int, frac] = amount.toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped},${frac} EUR`;
}

function formatDateDe(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

function scopeLabel(scope) {
  return String(scope || '').toLowerCase() === 'regional' ? 'regional' : 'deutschlandweit';
}

function invoiceFilename(payment) {
  const raw = String(payment?.invoiceNumber || 'Rechnung').replace(/[^\w.-]+/g, '_');
  return `${raw || 'Rechnung'}.pdf`;
}

function linePricing(payment) {
  const total = Math.max(0, Number(payment.netCents) || Number(payment.grossCents) || 0);
  const leads = Math.max(1, Number(payment.leadCount) || 1);
  const unit = Math.round(total / leads);
  const perLead = leads > 1 && unit * leads === total && unit >= 1000;
  if (perLead) {
    return { qty: leads, unitCents: unit, totalCents: total, leadCount: leads };
  }
  return { qty: 1, unitCents: total, totalCents: total, leadCount: leads };
}

function itemDescription(payment, pricing) {
  const leadType = payment.leadType || 'PKV';
  const scope = scopeLabel(payment.scope);
  const base = `VANTARO Lead-Paket ${leadType} / ${scope}`;
  if (pricing.qty === 1 && pricing.leadCount > 1) {
    return `${base} (${pricing.leadCount} Leads)`;
  }
  return base;
}

function recipientTitle(payment) {
  return payment.billingCompany || payment.billingName || payment.billingEmail || 'Beraterkonto';
}

function recipientLines(payment) {
  const lines = [];
  const title = recipientTitle(payment);
  lines.push(title);
  if (payment.billingName && payment.billingName !== title) lines.push(payment.billingName);
  if (payment.billingStreet) lines.push(payment.billingStreet);
  const city = [payment.billingZip, payment.billingCity].filter(Boolean).join(' ');
  if (city) lines.push(city);
  return lines;
}

function wordmark(ops, x, y, size = 20) {
  const label = 'VANTARO';
  ops.push(rgb(...INK));
  ops.push(text(x, y, label, { font: 'F2', size }));
  const table = WIDTH_HELVETICA_BOLD;
  let cursor = 0;
  const centers = [];
  for (const char of label) {
    const w = ((table[pdfByte(char)] || 500) * size) / 1000;
    if (char === 'A') centers.push(x + cursor + w / 2);
    cursor += w;
  }
  const triW = size * 0.28;
  const triH = size * 0.22;
  const triY = y - size * 0.08;
  centers.forEach((cx, index) => {
    ops.push(rgb(...(index === 0 ? TEAL : CORAL)));
    ops.push(triangle(cx, triY + triH, cx - triW / 2, triY, cx + triW / 2, triY));
  });
}

function buildContent(payment) {
  const ops = [];
  const invoiceDate = formatDateDe(payment.paidAt || payment.createdAt);
  const pricing = linePricing(payment);
  const payableCents = Number(payment.netCents) || Number(payment.grossCents) || pricing.totalCents;
  const net = formatEuroDe(payableCents);
  const gross = formatEuroDe(payableCents);
  const colQty = 338;
  const colUnit = 448;
  const colTotal = CONTENT_RIGHT;
  const tableWidth = CONTENT_RIGHT - MARGIN;

  wordmark(ops, MARGIN, PAGE_H - 52, 20);

  const meta = [
    ['Rechnungs-Nr.', payment.invoiceNumber || '—'],
    ['Rechnungsdatum', invoiceDate],
    ['Ihre Kundennummer', payment.customerNumber || '—'],
    ['Ihr Ansprechpartner', 'René Schirner'],
  ];
  const metaValueX = 448;
  meta.forEach((row, index) => {
    const rowY = PAGE_H - 44 - index * 13;
    ops.push(rgb(...MUTED));
    ops.push(textRight(metaValueX - 12, rowY, row[0], { size: 8 }));
    ops.push(rgb(...INK));
    ops.push(text(metaValueX, rowY, row[1], { font: 'F2', size: 8 }));
  });

  let y = PAGE_H - 118;
  const people = recipientLines(payment);
  people.forEach((lineText, index) => {
    ops.push(rgb(...INK));
    ops.push(text(MARGIN, y, lineText, { font: index === 0 ? 'F2' : 'F1', size: index === 0 ? 11 : 9 }));
    y -= index === 0 ? 14 : 12;
  });

  y -= 10;
  ops.push(strokeRgb(...LINE));
  ops.push('0.6 w');
  ops.push(line(MARGIN, y, CONTENT_RIGHT, y));

  y -= 28;
  ops.push(rgb(...INK));
  ops.push(text(MARGIN, y, 'Sehr geehrte Damen und Herren,', { size: 10 }));
  y -= 18;
  ops.push(text(MARGIN, y, 'vielen Dank für Ihren Auftrag und das damit verbundene Vertrauen!', { size: 10 }));
  y -= 18;
  ops.push(text(MARGIN, y, 'Hiermit stellen wir Ihnen die folgenden Leistungen in Rechnung:', { size: 10 }));

  y -= 28;
  const headerH = 22;
  ops.push(rgb(...HEADER_BG));
  ops.push(rect(MARGIN, y - 6, tableWidth, headerH, true));
  ops.push(rgb(...INK));
  const headerY = y;
  ops.push(text(MARGIN + 10, headerY, 'Beschreibung', { font: 'F2', size: 8 }));
  ops.push(textRight(colQty, headerY, 'Menge', { font: 'F2', size: 8 }));
  ops.push(textRight(colUnit, headerY, 'Einzelpreis', { font: 'F2', size: 8 }));
  ops.push(textRight(colTotal - 10, headerY, 'Gesamtpreis', { font: 'F2', size: 8 }));

  y -= 28;
  ops.push(rgb(...INK));
  const descMax = colQty - 36 - MARGIN;
  const descLines = wrapText(itemDescription(payment, pricing), 'F1', 9, descMax);
  descLines.forEach((lineText, index) => {
    ops.push(text(MARGIN + 10, y - index * 12, lineText, { size: 9 }));
  });
  ops.push(textRight(colQty, y, String(pricing.qty), { size: 9 }));
  ops.push(textRight(colUnit, y, `${pricing.qty} x ${formatEuroDe(pricing.unitCents)}`, { size: 9 }));
  ops.push(textRight(colTotal - 10, y, formatEuroDe(pricing.totalCents), { size: 9 }));

  y -= 18 + Math.max(0, descLines.length - 1) * 12;
  ops.push(strokeRgb(...LINE));
  ops.push('0.5 w');
  ops.push(line(MARGIN, y, CONTENT_RIGHT, y));

  y -= 22;
  ops.push(rgb(...INK));
  ops.push(text(MARGIN + 10, y, 'Gesamtbetrag netto', { size: 9 }));
  ops.push(textRight(colTotal - 10, y, net, { size: 9 }));
  y -= 16;
  ops.push(text(MARGIN + 10, y, 'Nicht im Inland steuerbare Leistung', { size: 9 }));
  ops.push(textRight(colTotal - 10, y, formatEuroDe(0), { size: 9 }));

  y -= 20;
  const barH = 22;
  ops.push(rgb(...BRAND));
  ops.push(rect(MARGIN, y - 6, tableWidth, barH, true));
  ops.push(rgb(...WHITE));
  ops.push(text(MARGIN + 10, y, 'Gesamtbetrag', { font: 'F2', size: 10 }));
  ops.push(textRight(colTotal - 10, y, gross, { font: 'F2', size: 10 }));

  y -= 36;
  ops.push(rgb(...MUTED));
  const notes = [
    'Nicht im Inland steuerbare Leistung: Es fällt keine Umsatzsteuer an. Der Gesamtbetrag ist der Paketpreis, ohne MwSt.-Aufschlag.',
    'Diese Rechnung zeigt den Betrag für das gebuchte Lead-Paket. Eine Übersicht der zugewiesenen Leads finden Sie in der VANTARO-Plattform.',
    'VANTARO ist keine Versicherung und kein Versicherungsvermittler. Elektronisch erstellt und ohne Unterschrift gültig.',
  ];
  if (payment.testMode) {
    notes.unshift('Testmodus — keine handelsübliche Rechnung.');
  }
  notes.forEach((note) => {
    wrapText(note, 'F1', 8, tableWidth).forEach((wrapped) => {
      ops.push(text(MARGIN, y, wrapped, { size: 8 }));
      y -= 11;
    });
    y -= 4;
  });

  const footerH = 78;
  ops.push(rgb(...BRAND));
  ops.push(rect(0, 0, PAGE_W, footerH, true));
  ops.push(rgb(...WHITE));
  const footerY = 52;
  const cols = [
    ['VANTARO', 'René Schirner', 'Lead-Matching'],
    ['E-Mail: info@vantaro.io', 'Web: www.vantaro.io'],
    ['Geschäftsführung', 'René Schirner', 'USt. 0 %'],
    ['Bank: ProCredit Bank', 'Zahlung per Karte'],
  ];
  cols.forEach((col, index) => {
    const x = MARGIN + index * 125;
    col.forEach((entry, lineIndex) => {
      ops.push(text(x, footerY - lineIndex * 10, entry, { size: 7 }));
    });
  });
  ops.push(text((PAGE_W - stringWidth('1/1', 'F1', 7)) / 2, 10, '1/1', { size: 7 }));

  return ops.join('\n');
}

function buildPdf(contentLatin1) {
  const content = Buffer.from(contentLatin1, 'latin1');
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'latin1'),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
      'latin1',
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'),
      content,
      Buffer.from('\nendstream', 'latin1'),
    ]),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'latin1'),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>', 'latin1'),
  ];

  const parts = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [0];
  let pos = parts[0].length;
  objects.forEach((body, index) => {
    offsets.push(pos);
    const wrapped = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, 'latin1'),
      body,
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
    parts.push(wrapped);
    pos += wrapped.length;
  });

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

export function buildInvoicePdf(payment) {
  return buildPdf(buildContent(payment || {}));
}

export function invoiceDownloadName(payment) {
  return invoiceFilename(payment);
}
