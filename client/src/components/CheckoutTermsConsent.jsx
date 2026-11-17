/**
 * Mandatory consent before the ProCredit payment page (bank requirement).
 * Links open the public legal pages in a new tab so the checkout dialog stays open.
 */
export default function CheckoutTermsConsent({ checked, onChange, disabled = false }) {
  return (
    <label className="broker-checkout-terms">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        required
        aria-required="true"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        Ich habe die{' '}
        <a href="/#agb" target="_blank" rel="noopener noreferrer">
          Allgemeinen Geschäftsbedingungen
        </a>{' '}
        und die{' '}
        <a href="/#erstattung" target="_blank" rel="noopener noreferrer">
          Erstattungsrichtlinie
        </a>{' '}
        gelesen und akzeptiere sie. <span className="broker-checkout-terms-req">(Pflichtfeld)</span>
      </span>
    </label>
  );
}
