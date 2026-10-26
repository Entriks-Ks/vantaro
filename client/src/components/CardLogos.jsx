// Accepted card brands — ProCredit requires the Visa and Mastercard logos on the site.
export default function CardLogos({ className = '' }) {
  return (
    <span className={className ? `card-logos ${className}` : 'card-logos'} aria-label="Akzeptiert: Visa, Mastercard">
      <img src="/visa.jpg" alt="Verified by Visa" width={48} height={24} loading="lazy" />
      <img src="/mastercard.jpg" alt="Mastercard SecureCode" width={48} height={20} loading="lazy" />
    </span>
  );
}
