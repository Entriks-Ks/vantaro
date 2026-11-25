// Accepted card brands — ProCredit requires the Visa and Mastercard logos on the site.
import { L } from '../lib/i18n';

export default function CardLogos({ className = '' }) {
  return (
    <span className={className ? `card-logos ${className}` : 'card-logos'} aria-label={L('Akzeptiert: Visa, Mastercard', 'Accepted: Visa, Mastercard')}>
      <img src="/visa.jpg" alt="Verified by Visa" width={48} height={24} loading="lazy" />
      <img src="/mastercard.jpg" alt="Mastercard SecureCode" width={48} height={20} loading="lazy" />
    </span>
  );
}
