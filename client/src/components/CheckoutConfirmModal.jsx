import { useEffect, useId, useRef } from 'react';
import { ArrowRight, CircleAlert, LoaderCircle, Lock, ShieldCheck, X } from 'lucide-react';
import CardLogos from './CardLogos';
import CheckoutTermsConsent from './CheckoutTermsConsent';
import { discountLineLabel } from '../lib/discounts';
import { formatEuroExact } from '../pages/dashboard/helpers';

/**
 * "Zahlung bestätigen" — last step before the redirect to the ProCredit payment page.
 * Shared by the lead (PKV) and energy (leads/Termine) checkouts.
 */
export default function CheckoutConfirmModal({
  productLabel,
  productTitle = '',
  quantity,
  unitPlural = 'Leads',
  listCents,
  netCents,
  discountLines = [],
  details = null,
  offers = null,
  acceptedTerms = false,
  onAcceptedTermsChange,
  error = '',
  paying = false,
  onCancel,
  onConfirm,
}) {
  const titleId = useId();
  const hintId = useId();
  const panelRef = useRef(null);
  const errorRef = useRef(null);
  const qty = Math.max(1, Number(quantity) || 1);
  const list = Number(listCents) || 0;
  const net = Number(netCents) || 0;
  const savings = Math.max(0, list - net);
  const unitCents = Math.round(list / qty);

  useEffect(() => {
    panelRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !paying) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paying, onCancel]);

  // On small screens the error sits below the fold of the scrolling body.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  return (
    <div
      className="checkout-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !paying) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className="checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="checkout-modal__head">
          <span className="checkout-modal__icon" aria-hidden="true">
            <Lock size={19} strokeWidth={2.2} />
          </span>
          <div className="checkout-modal__heading">
            <h2 id={titleId}>Zahlung bestätigen</h2>
            <p>Prüfen Sie Ihre Bestellung. Danach geht es zur sicheren Zahlungsseite der Bank.</p>
          </div>
          <button
            type="button"
            className="checkout-modal__close"
            disabled={paying}
            onClick={onCancel}
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="checkout-modal__body">
          {details ? (
            <section>
              <h3 className="checkout-modal__section-label">Lieferung</h3>
              {details}
            </section>
          ) : null}

          <section>
            <h3 className="checkout-modal__section-label">Ihre Bestellung</h3>
            <div className="checkout-modal__summary">
              <div className="checkout-modal__product">
                <div>
                  <strong>{productLabel}</strong>
                  {productTitle && productTitle !== productLabel ? <small>{productTitle}</small> : null}
                </div>
                <span className="checkout-modal__qty">{qty} {unitPlural}</span>
              </div>

              <div className="checkout-modal__line">
                <span>{qty} × {formatEuroExact(unitCents)}</span>
                <span>{formatEuroExact(list)}</span>
              </div>
              {discountLines.map((line) => (
                <div key={line.discount?.id || line.role} className="checkout-modal__line is-discount">
                  <span>{discountLineLabel(line)}</span>
                  <span>− {formatEuroExact(line.amountCents)}</span>
                </div>
              ))}

              <div className="checkout-modal__total">
                <span>
                  Gesamtbetrag
                  <small>Einmalzahlung per Kreditkarte</small>
                </span>
                <strong>{formatEuroExact(net)}</strong>
              </div>
              {savings > 0 ? (
                <span className="checkout-modal__savings">Sie sparen {formatEuroExact(savings)}</span>
              ) : null}
            </div>
          </section>

          {offers}

          <div className="checkout-modal__secure">
            <ShieldCheck className="checkout-modal__secure-icon" size={22} strokeWidth={2} aria-hidden="true" />
            <div className="checkout-modal__secure-copy">
              <strong>Sichere Zahlung über die ProCredit Bank</strong>
              Ihre Kartendaten geben Sie ausschließlich auf der Seite der Bank ein.
            </div>
            <CardLogos className="checkout-modal__cards" />
          </div>

          <CheckoutTermsConsent
            checked={acceptedTerms}
            disabled={paying}
            onChange={onAcceptedTermsChange}
          />

          {error ? (
            <div ref={errorRef} className="checkout-modal__error" role="alert">
              <CircleAlert size={17} strokeWidth={2.2} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <div className="checkout-modal__foot">
          <button
            type="button"
            className="checkout-modal__cancel"
            disabled={paying}
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="checkout-modal__pay"
            disabled={paying || !acceptedTerms}
            aria-describedby={acceptedTerms ? undefined : hintId}
            onClick={onConfirm}
          >
            {paying ? (
              <>
                <LoaderCircle className="checkout-modal__spin" size={17} aria-hidden="true" />
                Weiterleitung zur Bank…
              </>
            ) : (
              <>
                <Lock size={15} strokeWidth={2.4} aria-hidden="true" />
                {formatEuroExact(net)} bezahlen
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </>
            )}
          </button>
          {!acceptedTerms && !paying ? (
            <p id={hintId} className="checkout-modal__hint">
              Bitte bestätigen Sie zuerst die AGB und die Erstattungsrichtlinie.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
