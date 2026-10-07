import { useEffect, useState } from 'react';
import { Check, Clock, TicketPercent } from 'lucide-react';
import { remainingTimeLabel } from '../../lib/discounts';
import { formatDateTime, formatEuroExact } from './helpers';

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
    if (offer.appliesTo === 'appointments') return 'Nur Termine';
    if (offer.appliesTo === 'leads') return 'Nur Leads';
    return unitLabel === 'Termin' ? 'Für Termine' : 'Für Leads';
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
                {selected ? 'Wird für dieses Paket eingelöst' : 'Einmal-Rabatt'}
                <span> · {scopeLine(offer, unitLabel)}</span>
              </p>
              {offer.expiresAt ? (
                <p className="broker-voucher__timer">
                  <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
                  <span>
                    Bis {formatDateTime(offer.expiresAt)}
                    {remaining ? ` · ${remaining}` : ''}
                  </span>
                </p>
              ) : (
                <p className="broker-voucher__timer broker-voucher__timer--muted">Ohne Ablaufdatum</p>
              )}
            </div>
            <button
              type="button"
              className={`broker-voucher__btn${selected ? ' is-on' : ''}`}
              onClick={() => onChange(selected ? '' : offer.id)}
            >
              {selected ? 'Nicht nutzen' : 'Einlösen'}
            </button>
          </article>
        );
      })}
    </div>
  );
}
