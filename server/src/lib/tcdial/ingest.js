import { getTcDialLead } from './client.js';
import { mapTcDialLead, mergeDispositionNotes } from './mapLead.js';
import {
  createLead,
  findLeadByExternalId,
  updateLead,
} from '../leads.js';
import { supabaseConfig } from '../supabase.js';

/**
 * Fetches the TC-Dial lead and upserts it into Vantaro (source=api).
 */
export async function ingestTcDialDisposition(event = {}) {
  const leadId = event.leadId ?? event.lead_id;
  if (leadId == null || leadId === '') {
    const error = new Error('Webhook enthält keine leadId.');
    error.status = 400;
    throw error;
  }

  const remote = await getTcDialLead(leadId);
  const mapped = mapTcDialLead(remote, event);
  if (!mapped.externalId) {
    const error = new Error('TC-Dial Lead hat keine ID.');
    error.status = 502;
    throw error;
  }

  const existing = await findLeadByExternalId('tcdial', mapped.externalId);
  if (existing) {
    const notes = mergeDispositionNotes(existing.notes, mapped.notes);
    const patch = { notes };
    if (!existing.phone && mapped.phone) patch.phone = mapped.phone;
    if (!existing.email && mapped.email) patch.email = mapped.email;
    if (!existing.street && mapped.street) patch.street = mapped.street;
    if (!existing.zip && mapped.zip) patch.zip = mapped.zip;
    if (!existing.city && mapped.city) patch.city = mapped.city;
    if (!existing.date_of_birth && mapped.dateOfBirth) patch.dateOfBirth = mapped.dateOfBirth;

    const lead = await updateLead(existing.id, patch);
    return { lead, created: false, externalId: mapped.externalId };
  }

  if (!supabaseConfig.configured) {
    const error = new Error('Supabase ist nicht konfiguriert.');
    error.status = 503;
    throw error;
  }

  try {
    const lead = await createLead(mapped, {
      source: 'api',
      externalSource: 'tcdial',
      externalId: mapped.externalId,
      lenient: true,
    });
    return { lead, created: true, externalId: mapped.externalId };
  } catch (error) {
    // Race: another webhook created the same external lead
    if (error?.code === '23505' || /duplicate key/i.test(String(error?.message || ''))) {
      const again = await findLeadByExternalId('tcdial', mapped.externalId);
      if (again) {
        const notes = mergeDispositionNotes(again.notes, mapped.notes);
        const lead = await updateLead(again.id, { notes });
        return { lead, created: false, externalId: mapped.externalId };
      }
    }
    throw error;
  }
}

export function summarizeIngest(result) {
  return {
    ok: true,
    created: Boolean(result.created),
    externalId: result.externalId,
    leadId: result.lead?.id || null,
  };
}

export function columnMissingExternalId(error) {
  const message = String(error?.message || error?.code || '');
  return /external_source|external_id/i.test(message)
    && (/column/i.test(message) || /schema cache/i.test(message) || error?.code === 'PGRST204');
}
