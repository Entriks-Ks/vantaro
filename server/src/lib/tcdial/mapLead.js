import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { DEFAULT_LEAD_SCOPE } from '../scopes.js';

function trim(value) {
  if (value == null) return '';
  return String(value).trim();
}

function emptyToNull(value) {
  const text = trim(value);
  return text || null;
}

function normalizeEmail(raw) {
  const email = emptyToNull(raw)?.toLowerCase() || null;
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizePhone(raw) {
  const text = trim(raw);
  if (!text) return null;

  let candidate = text;
  if (/^00\d+/.test(candidate)) candidate = `+${candidate.slice(2)}`;

  const parsed = parsePhoneNumberFromString(candidate, 'DE');
  if (parsed?.isValid()) return parsed.format('E.164');

  const digits = candidate.replace(/[^\d+]/g, '');
  return digits || text;
}

function buildStreet(address = {}) {
  const street = trim(address.street);
  const house = trim(address.houseNumber);
  const extra = trim(address.additionalLine);
  const line = [street, house].filter(Boolean).join(' ').trim();
  if (line && extra) return `${line}, ${extra}`;
  return line || extra || null;
}

function normalizeZip(raw) {
  const digits = trim(raw).replace(/\D/g, '');
  return digits.length === 5 ? digits : null;
}

function nameFallback(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const tail = digits.slice(-4);
  return tail ? `Lead ${tail}` : 'Unbekannt';
}

function formatAdditionalData(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return items
    .map((item) => {
      const label = trim(item.formFieldName) || `Feld ${item.formFieldId ?? '?'}`;
      const form = trim(item.formName);
      const value = trim(item.value);
      if (!value) return null;
      return form ? `${form} / ${label}: ${value}` : `${label}: ${value}`;
    })
    .filter(Boolean)
    .join('\n');
}

function dispositionNote(event = {}, remote = {}) {
  const lines = [];
  lines.push(`TC-Dial Lead-ID: ${remote.id ?? event.leadId ?? '—'}`);
  if (event.campaignId != null) lines.push(`Kampagne-ID: ${event.campaignId}`);
  if (event.callStatusId != null) lines.push(`Call-Status-ID: ${event.callStatusId}`);
  if (event.agentId != null) lines.push(`Agent-ID: ${event.agentId}`);
  if (event.callDirection) lines.push(`Richtung: ${event.callDirection}`);
  if (event.callTime != null) lines.push(`Gesprächsdauer: ${event.callTime}s`);
  if (event.createdAt) lines.push(`Disposition: ${event.createdAt}`);

  const latest = Array.isArray(remote.dispositions) ? remote.dispositions[0] : null;
  if (latest?.callStatus?.name) {
    lines.push(`Status: ${latest.callStatus.name}${latest.callStatus.group ? ` (${latest.callStatus.group})` : ''}`);
  }
  if (latest?.campaign?.name) lines.push(`Kampagne: ${latest.campaign.name}`);
  if (latest?.agent) {
    const agentName = [latest.agent.firstName, latest.agent.lastName].map(trim).filter(Boolean).join(' ');
    if (agentName) lines.push(`Agent: ${agentName}`);
  }

  const extra = formatAdditionalData(remote.additionalData);
  if (extra) {
    lines.push('');
    lines.push('Formularfelder:');
    lines.push(extra);
  }

  return lines.join('\n');
}

function looksLikeDate(value) {
  const text = trim(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text);
}

/**
 * Maps a TC-Dial LeadResourceResponse (+ optional disposition event) to Vantaro createLead input.
 */
export function mapTcDialLead(remote = {}, event = {}) {
  const phone = normalizePhone(remote.mobile || remote.phone || remote.secondaryPhone);
  const firstName = emptyToNull(remote.firstname) || 'Unbekannt';
  const lastName = emptyToNull(remote.lastname) || nameFallback(phone);
  const dob = emptyToNull(remote.dateOfBirth);

  const note = dispositionNote(event, remote);

  return {
    firstName,
    lastName,
    dateOfBirth: dob && looksLikeDate(dob) ? dob : null,
    email: normalizeEmail(remote.email),
    phone,
    street: buildStreet(remote.address || {}),
    zip: normalizeZip(remote.address?.zipCode),
    city: emptyToNull(remote.address?.city),
    notes: note,
    scope: DEFAULT_LEAD_SCOPE,
    source: 'api',
    externalSource: 'tcdial',
    externalId: String(remote.id ?? event.leadId ?? ''),
  };
}

export function mergeDispositionNotes(existingNotes, nextNotes) {
  const previous = trim(existingNotes);
  const next = trim(nextNotes);
  if (!next) return previous || null;
  if (!previous) return next;
  if (previous.includes(next)) return previous;
  return `${previous}\n\n---\n\n${next}`;
}
