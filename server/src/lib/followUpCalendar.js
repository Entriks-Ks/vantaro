import { createHmac, timingSafeEqual } from 'node:crypto';
import { getApiOrigin } from './clientOrigin.js';

const EVENT_MINUTES = 15;

/** Apple Calendar / EventKit stays in the codebase; hide it in mail until the iOS app is ready. */
export const SHOW_APPLE_CALENDAR = false;

function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function icsUtc(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function signingKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.RESEND_API_KEY
    || 'vantaro-follow-up';
}

export function followUpIcsSignature(leadId, followUpAt) {
  return createHmac('sha256', signingKey())
    .update(`follow-up:${leadId}:${new Date(followUpAt).toISOString()}`)
    .digest('hex')
    .slice(0, 32);
}

export function isFollowUpIcsSignature(leadId, followUpAt, signature) {
  const expected = followUpIcsSignature(leadId, followUpAt);
  const given = String(signature || '');
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  } catch {
    return false;
  }
}

export function googleCalendarUrl({ title, details, startAt, minutes = EVENT_MINUTES }) {
  const start = new Date(startAt);
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${icsUtc(start)}/${icsUtc(end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl({ title, details, startAt, minutes = EVENT_MINUTES }) {
  const start = new Date(startAt);
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  const stamp = (value) => new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    rru: 'addevent',
    subject: title,
    body: details,
    startdt: stamp(start),
    enddt: stamp(end),
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params}`;
}

export function followUpQuery(leadId, followUpAt) {
  return new URLSearchParams({
    lead: leadId,
    at: new Date(followUpAt).toISOString(),
    sig: followUpIcsSignature(leadId, followUpAt),
  });
}

export function followUpIcsUrl(leadId, followUpAt) {
  return `${getApiOrigin()}/api/calendar/wiedervorlage.ics?${followUpQuery(leadId, followUpAt)}`;
}

export function followUpWebcalUrl(leadId, followUpAt) {
  const url = followUpIcsUrl(leadId, followUpAt);
  if (url.startsWith('https://')) return `webcals://${url.slice('https://'.length)}`;
  if (url.startsWith('http://')) return `webcal://${url.slice('http://'.length)}`;
  return url;
}

function berlinStamp(value) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

export function followUpAppleUrl(leadId, followUpAt) {
  return `${getApiOrigin()}/api/calendar/wiedervorlage?${followUpQuery(leadId, followUpAt)}`;
}

export function followUpAppUrl(leadId, followUpAt) {
  return `vantaro://wiedervorlage?${followUpQuery(leadId, followUpAt)}`;
}

export function toFollowUpEventJson(event) {
  const followUpAt = new Date(event.followUpAt).toISOString();
  return {
    leadId: event.leadId,
    leadName: event.leadName,
    title: `Wiedervorlage: ${event.leadName}`,
    followUpAt,
    durationMinutes: EVENT_MINUTES,
    phone: event.phone || '',
    leadUrl: event.leadUrl || '',
    notes: [
      `Wiedervorlage für ${event.leadName}`,
      event.phone ? `Telefon: ${event.phone}` : '',
      event.leadUrl || '',
    ].filter(Boolean).join('\n'),
  };
}

export function buildFollowUpIcs({
  leadId,
  leadName,
  followUpAt,
  phone,
  leadUrl,
  minutes = EVENT_MINUTES,
  eventType = 'wiedervorlage',
  method = 'PUBLISH',
  attendeeEmail = '',
  organizerEmail = '',
  sequence,
}) {
  const noun = eventType === 'termin' ? 'Termin' : 'Wiedervorlage';
  const start = berlinStamp(followUpAt);
  const end = berlinStamp(new Date(new Date(followUpAt).getTime() + minutes * 60 * 1000));
  const stamp = icsUtc(new Date());
  const title = `${noun}: ${leadName}`;
  const description = [
    `${noun} für ${leadName}`,
    phone ? `Telefon: ${phone}` : '',
    leadUrl ? `Lead: ${leadUrl}` : '',
  ].filter(Boolean).join('\n');
  const calendarMethod = ['REQUEST', 'CANCEL'].includes(String(method || '').toUpperCase())
    ? String(method).toUpperCase()
    : 'PUBLISH';
  const organizer = String(organizerEmail || '').trim();
  const attendee = String(attendeeEmail || '').trim();
  const nextSequence = Number.isFinite(Number(sequence))
    ? Math.max(0, Math.floor(Number(sequence)))
    : Math.max(1, Math.floor(Date.now() / 1000));
  const cancelled = calendarMethod === 'CANCEL';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//VANTARO//${noun}//DE`,
    'CALSCALE:GREGORIAN',
    `METHOD:${calendarMethod}`,
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'X-LIC-LOCATION:Europe/Berlin',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${eventType}-${leadId}@vantaro.io`,
    `DTSTAMP:${stamp}`,
    `LAST-MODIFIED:${stamp}`,
    `DTSTART;TZID=Europe/Berlin:${start}`,
    `DTEND;TZID=Europe/Berlin:${end}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    `SEQUENCE:${nextSequence}`,
    organizer ? `ORGANIZER;CN=VANTARO:mailto:${organizer}` : '',
    attendee ? `ATTENDEE;CN=${icsEscape(attendee)};RSVP=FALSE;PARTSTAT=${cancelled ? 'DECLINED' : 'ACCEPTED'}:mailto:${attendee}` : '',
    leadUrl ? `URL:${leadUrl}` : '',
    cancelled ? '' : 'BEGIN:VALARM',
    cancelled ? '' : 'ACTION:DISPLAY',
    cancelled ? '' : `DESCRIPTION:${noun}`,
    cancelled ? '' : 'TRIGGER:-PT15M',
    cancelled ? '' : 'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return `${lines.join('\r\n')}\r\n`;
}

export function followUpCalendarLinks({
  leadId,
  leadName,
  followUpAt,
  phone,
  leadUrl,
  eventType = 'wiedervorlage',
}) {
  const noun = eventType === 'termin' ? 'Termin' : 'Wiedervorlage';
  const title = `${noun}: ${leadName}`;
  const details = [
    `${noun} für ${leadName}`,
    phone ? `Telefon: ${phone}` : '',
    leadUrl || '',
  ].filter(Boolean).join('\n');

  return {
    title,
    googleUrl: googleCalendarUrl({ title, details, startAt: followUpAt }),
    outlookUrl: outlookCalendarUrl({ title, details, startAt: followUpAt }),
    appleUrl: eventType === 'wiedervorlage' ? followUpAppleUrl(leadId, followUpAt) : '',
  };
}
