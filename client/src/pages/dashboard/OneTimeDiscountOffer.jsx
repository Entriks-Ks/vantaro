import { useEffect, useState } from 'react';
import { Check, Clock, TicketPercent } from 'lucide-react';
import { remainingTimeLabel } from '../../lib/discounts';
import { formatDateTime, formatEuroExact } from './helpers';
import { L } from '../../lib/i18n';

export function visibleOneTimeOffers(offers, pick, packageKey) {
  const list = offers || [];
  if (!pick?.id) return list;
  if (pick.key === packageKey) return list;
  return list.filter((offer) => offer.id !== pick.id);
}

export function oneTimePickFor(packageKey, pick) {
  if (!pick?.id || pick.key !== packageKey) return '';
  return pick.id;
}

function valueHeadline(offer) {
  if (!offer) return '';
  if (offer.valueType === 'percent') return `−${offer.value} %`;
  return `−${formatEuroExact(offer.value)}`;
}

function scopeLine(offer, unitLabel) {
    if (offer.appliesTo === 'appointments') return L('Nur Termine', 'Appointments only');
    if (offer.appliesTo === 'leads') return L('Nur Leads', 'Leads only');
    return ['termin', 'appointment'].includes(String(unitLabel || '').toLowerCase())
      ? L('Für Termine', 'For appointments')
      : L('Für Leads', 'For leads');
}

export function OneTimeDiscountOffer({
  offers = [],
  selectedId = '',
  onChange,
  unitLabel = 'Lead',
  compact = false,
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!offers.some((entry) => entry.expiresAt)) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 15000);
    return () => window.clearInterval(timer);
  }, [offers]);

  if (!offers.length) return null;

  return (
    <div className={`broker-voucher-list${compact ? ' is-compact' : ''}`}>
      {offers.map((offer) => {
        const selected = selectedId === offer.id;
        const remaining = remainingTimeLabel(offer.expiresAt);
        return (
          <article key={offer.id} className={`broker-voucher${selected ? ' is-on' : ''}`}>
            <div className="broker-voucher__stamp" aria-hidden="true">
              {selected ? <Check size={22} strokeWidth={2.4} /> : <TicketPercent size={22} strokeWidth={2.1} />}
            </div>
            <div className="broker-voucher__body">
              <div className="broker-voucher__top">
                <strong className="broker-voucher__value">{valueHeadline(offer)}</strong>
                {offer.code ? <span className="broker-voucher__code">{offer.code}</span> : null}
              </div>
              <p className="broker-voucher__title">
                {selected
                  ? L('Wird für dieses Paket eingelöst', 'Applied to this package')
                  : L('Einmal-Rabatt', 'One-time discount')}
                <span> · {scopeLine(offer, unitLabel)}</span>
              </p>
              {offer.expiresAt ? (
                <p className="broker-voucher__timer">
                  <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
                  <span>
                    {L('Bis', 'Until')} {formatDateTime(offer.expiresAt)}
                    {remaining ? ` · ${remaining}` : ''}
                  </span>
                </p>
              ) : (
                <p className="broker-voucher__timer broker-voucher__timer--muted">{L('Ohne Ablaufdatum', 'No expiry date')}</p>
              )}
            </div>
            <button
              type="button"
              className={`broker-voucher__btn${selected ? ' is-on' : ''}`}
              onClick={() => onChange(selected ? '' : offer.id)}
            >
              {selected ? L('Nicht nutzen', "Don't use") : L('Einlösen', 'Redeem')}
            </button>
          </article>
        );
      })}
    </div>
  );
}
