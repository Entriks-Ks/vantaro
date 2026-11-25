import { L } from '../lib/i18n';

/**
 * Mandatory consent before the ProCredit payment page (bank requirement).
 * Links open the public legal pages in a new tab so the checkout dialog stays open.
 */
export default function CheckoutTermsConsent({ checked, onChange, disabled = false }) {
  return (
    <label className={`broker-checkout-terms${checked ? ' is-checked' : ''}`}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        required
        aria-required="true"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {L('Ich habe die', 'I have read and accept the')}{' '}
        <a href="/#agb" target="_blank" rel="noopener noreferrer">
          {L('Allgemeinen Geschäftsbedingungen', 'Terms & conditions')}
        </a>{' '}
        {L('und die', 'and the')}{' '}
        <a href="/#erstattung" target="_blank" rel="noopener noreferrer">
          {L('Erstattungsrichtlinie', 'Refund policy')}
        </a>{L(' gelesen und akzeptiere sie.', '.')} <span className="broker-checkout-terms-req">{L('(Pflichtfeld)', '(required)')}</span>
      </span>
    </label>
  );
}
