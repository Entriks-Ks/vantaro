import React, { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import DarkVeil from './DarkVeil';
import './ContactUs.css';

const FOCUS_OPTIONS = ['PKV', 'BU / Vorsorge', 'Gewerbe / Unternehmer', 'Mehrere Sparten'];

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
      setError('Es gab ein Problem beim Übermitteln. Bitte versuchen Sie es erneut.');
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
              <h3>Kapazität prüfen</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="contact-form-row">
                <div className="contact-form-group">
                  <label className="contact-form-label" htmlFor="contact-name">
                    Ihr Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    className="contact-form-input"
                    placeholder="Ihr Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label className="contact-form-label" htmlFor="contact-email">
                    E-Mail <span className="required-star">*</span>
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    className="contact-form-input"
                    placeholder="E-Mail"
                    value={formData.email}
                    onChange={handleInputChange}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="contact-form-group">
                <label className="contact-form-label" htmlFor="contact-company">
                  Maklerhaus / Unternehmen <span className="required-star">*</span>
                </label>
                <input
                  id="contact-company"
                  name="company"
                  type="text"
                  className="contact-form-input"
                  placeholder="Maklerhaus / Unternehmen"
                  value={formData.company}
                  onChange={handleInputChange}
                  autoComplete="organization"
                  required
                />
              </div>

              <div className="contact-form-group">
                <label className="contact-form-label" htmlFor="contact-focus">
                  Ihr Fokus <span className="required-star">*</span>
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
                    Ihr Fokus
                  </option>
                  {FOCUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="contact-form-group">
                <label className="contact-form-label" htmlFor="contact-message">
                  Was möchten Sie mit VANTARO erreichen? <span className="required-star">*</span>
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  className="contact-form-textarea"
                  placeholder="Was möchten Sie mit VANTARO erreichen?"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={4}
                  required
                />
              </div>

              <button type="submit" className="contact-submit-btn" disabled={loading}>
                {loading ? 'Wird gesendet...' : (
                  <>
                    Demo-Anfrage senden <span className="arrow">↗</span>
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
              Ihre Angaben werden vertraulich behandelt. Es gelten unser{' '}
              <a href="#impressum">Impressum</a> und die{' '}
              <a href="#datenschutz">Datenschutzerklärung</a>.
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
                  <div className="eyebrow light">Der nächste sinnvolle Schritt</div>
                  <h2>
                    Prüfen Sie nicht, ob VANTARO groß klingt.{' '}
                    <span>Prüfen Sie, ob es für Sie funktioniert.</span>
                  </h2>
                  <p>
                    Starten Sie mit einem strukturierten Pilotgespräch. Wir schauen auf Sparte, Region, Kapazität, Qualitätsstufe und die Kennzahlen, die für Ihr Haus wirklich zählen.
                  </p>
                  <div className="contact-cutout-actions">
                    <a
                      className="btn btn-primary"
                      href="mailto:info@vantaro.io?subject=VANTARO%20Pilotgespr%C3%A4ch"
                    >
                      Pilotgespräch per E-Mail <span className="arrow">↗</span>
                    </a>
                    <a className="btn btn-outline-light" href="#preise">
                      Preise ansehen <span className="arrow">↓</span>
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
              <div className="vantaro-toast-title">Anfrage erfolgreich übermittelt</div>
              <div className="vantaro-toast-message">
                Vielen Dank! Ihre Anfrage wurde erfolgreich an uns übermittelt. Wir werden uns zeitnah bei Ihnen melden.
              </div>
            </div>
            <button
              type="button"
              className="vantaro-toast-close"
              onClick={() => setSubmitted(false)}
              aria-label="Schließen"
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
