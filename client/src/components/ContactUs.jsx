import React, { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import DarkVeil from './DarkVeil';
import './ContactUs.css';
import { L } from '../lib/i18n';

const FOCUS_OPTIONS = ['Versicherung / PKV', 'Energie / Photovoltaik', 'Energie / Wärmepumpe', 'Mehrere Bereiche'];
// Display labels only: the German option value is what reaches the VANTARO inbox.
const FOCUS_LABELS = {
  'Versicherung / PKV': L('Versicherung / PKV', 'Insurance / private health (PKV)'),
  'Energie / Photovoltaik': L('Energie / Photovoltaik', 'Energy / solar PV'),
  'Energie / Wärmepumpe': L('Energie / Wärmepumpe', 'Energy / heat pump'),
  'Mehrere Bereiche': L('Mehrere Bereiche', 'Several lines of business'),
};

export default function ContactUs() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    focus: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        setSubmitted(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSubmitted(false);

    try {
      const response = await fetch('https://formsubmit.co/ajax/info@vantaro.io', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          _subject: `Neue VANTARO Kapazitätsprüfung: ${formData.company || formData.name}`,
          _template: 'table',
          _captcha: 'false',
          Name: formData.name,
          'E-Mail': formData.email,
          'Maklerhaus / Unternehmen': formData.company,
          Fokus: formData.focus,
          'Was möchten Sie mit VANTARO erreichen': formData.message,
        }),
      });

      const result = await response.json();

      if (response.ok || result.success === 'true' || result.success === true) {
        setSubmitted(true);
        setFormData({
          name: '',
          email: '',
          company: '',
          focus: '',
          message: '',
        });
      } else {
        throw new Error(result.message || 'Fehler beim Senden');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(L('Es gab ein Problem beim Übermitteln. Bitte versuchen Sie es erneut.', 'There was a problem sending your request. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="contact-us-section" id="kontakt">
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <clipPath id="contact-shape-clip" clipPathUnits="objectBoundingBox">
            <path d="M 0.40,0 
                     C 0.43,0 0.92,0 0.94,0 
                     C 0.98,0 1,0.02 1,0.06 
                     L 1,0.94 
                     C 1,0.98 0.98,1 0.94,1 
                     L 0.06,1 
                     C 0.02,1 0,0.98 0,0.94 
                     L 0,0.18 
                     C 0,0.14 0.02,0.12 0.06,0.12 
                     L 0.28,0.12 
                     C 0.33,0.12 0.35,0.08 0.36,0.04 
                     C 0.37,0.01 0.38,0 0.42,0 Z" />
          </clipPath>
        </defs>
      </svg>

      <div className="contact-us-container">
        <div className="contact-us-grid">
          <div className="contact-form-card">
            <div className="contact-form-intro">
              <h3>{L('Kapazität prüfen', 'Check capacity')}</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="contact-form-row">
                <div className="contact-form-group">
                  <label className="contact-form-label" htmlFor="contact-name">
                    {L('Ihr Name', 'Your name')} <span className="required-star">*</span>
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    className="contact-form-input"
                    placeholder={L('Ihr Name', 'Your name')}
                    value={formData.name}
                    onChange={handleInputChange}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label className="contact-form-label" htmlFor="contact-email">
                    {L('E-Mail', 'Email')} <span className="required-star">*</span>
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    className="contact-form-input"
                    placeholder={L('E-Mail', 'Email')}
                    value={formData.email}
                    onChange={handleInputChange}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="contact-form-group">
                <label className="contact-form-label" htmlFor="contact-company">
                  {L('Maklerhaus / Unternehmen', 'Brokerage / company')} <span className="required-star">*</span>
                </label>
                <input
                  id="contact-company"
                  name="company"
                  type="text"
                  className="contact-form-input"
                  placeholder={L('Maklerhaus / Unternehmen', 'Brokerage / company')}
                  value={formData.company}
                  onChange={handleInputChange}
                  autoComplete="organization"
                  required
                />
              </div>

              <div className="contact-form-group">
                <label className="contact-form-label" htmlFor="contact-focus">
                  {L('Ihr Fokus', 'Your focus')} <span className="required-star">*</span>
                </label>
                <select
                  id="contact-focus"
                  name="focus"
                  className="contact-form-input contact-form-select"
                  value={formData.focus}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled hidden>
                    {L('Ihr Fokus', 'Your focus')}
                  </option>
                  {FOCUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {FOCUS_LABELS[option] || option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="contact-form-group">
                <label className="contact-form-label" htmlFor="contact-message">
                  {L('Was möchten Sie mit VANTARO erreichen?', 'What would you like to achieve with VANTARO?')} <span className="required-star">*</span>
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  className="contact-form-textarea"
                  placeholder={L('Was möchten Sie mit VANTARO erreichen?', 'What would you like to achieve with VANTARO?')}
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={4}
                  required
                />
              </div>

              <button type="submit" className="contact-submit-btn" disabled={loading}>
                {loading ? L('Wird gesendet...', 'Sending...') : (
                  <>
                    {L('Demo-Anfrage senden', 'Send demo request')} <span className="arrow">↗</span>
                  </>
                )}
              </button>

              {error && (
                <div className="contact-form-feedback error">
                  {error}
                </div>
              )}
            </form>

            <p className="contact-legal-note">
              {L('Ihre Angaben werden vertraulich behandelt. Es gelten unser', 'Your details are treated confidentially. Our')}{' '}
              <a href="#impressum">{L('Impressum', 'Legal notice')}</a> {L('und die', 'and')}{' '}
              <a href="#datenschutz">{L('Datenschutzerklärung', 'Privacy policy')}</a>{L('.', ' apply.')}
            </p>
          </div>

          <div className="contact-visual-col">
            <div className="contact-image-wrapper">
              <div className="contact-cutout-panel">
                <div className="contact-veil-bg" aria-hidden="true">
                  <DarkVeil
                    hueShift={46}
                    noiseIntensity={0.02}
                    scanlineIntensity={0.1}
                    scanlineFrequency={0.7}
                    warpAmount={0.22}
                    speed={0.5}
                  />
                  <div className="contact-veil-overlay" />
                </div>
                <div className="contact-cutout-content">
                  <div className="eyebrow light">{L('Der nächste sinnvolle Schritt', 'The next sensible step')}</div>
                  <h2>
                    {L('Prüfen Sie nicht, ob VANTARO groß klingt.', "Don't check whether VANTARO sounds big.")}{' '}
                    <span>{L('Prüfen Sie, ob es für Sie funktioniert.', 'Check whether it works for you.')}</span>
                  </h2>
                  <p>
                    {L('Starten Sie mit einem strukturierten Pilotgespräch. Wir schauen auf Bereich (Versicherung oder Energie), Region, Kapazität, Qualitätsstufe und die Kennzahlen, die für Ihr Unternehmen wirklich zählen.', 'Start with a structured pilot call. We look at line of business (insurance or energy), region, capacity, quality level and the metrics that really matter to your company.')}
                  </p>
                  <div className="contact-cutout-actions">
                    <a
                      className="btn btn-primary"
                      href="mailto:info@vantaro.io?subject=VANTARO%20Pilotgespr%C3%A4ch"
                    >
                      {L('Pilotgespräch per E-Mail', 'Pilot call by email')} <span className="arrow">↗</span>
                    </a>
                    <a className="btn btn-outline-light" href="#preise">
                      {L('Preise ansehen', 'View pricing')} <span className="arrow">↓</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {submitted && (
        <div className="vantaro-toast-container" role="alert">
          <div className="vantaro-toast">
            <div className="vantaro-toast-icon">
              <CheckCircle2 size={20} />
            </div>
            <div className="vantaro-toast-body">
              <div className="vantaro-toast-title">{L('Anfrage erfolgreich übermittelt', 'Request sent successfully')}</div>
              <div className="vantaro-toast-message">
                {L('Vielen Dank! Ihre Anfrage wurde erfolgreich an uns übermittelt. Wir werden uns zeitnah bei Ihnen melden.', "Thank you! Your request has been sent to us successfully. We'll get back to you shortly.")}
              </div>
            </div>
            <button
              type="button"
              className="vantaro-toast-close"
              onClick={() => setSubmitted(false)}
              aria-label={L('Schließen', 'Close')}
            >
              <X size={16} />
            </button>
            <div className="vantaro-toast-progress" />
          </div>
        </div>
      )}
    </section>
  );
}
