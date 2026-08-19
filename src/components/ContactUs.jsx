import React, { useState } from 'react';
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
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 6000);
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
                    Ihr Name
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
                    E-Mail
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
                  Maklerhaus / Unternehmen
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
                />
              </div>

              <div className="contact-form-group">
                <label className="contact-form-label" htmlFor="contact-focus">
                  Ihr Fokus
                </label>
                <select
                  id="contact-focus"
                  name="focus"
                  className="contact-form-input contact-form-select"
                  value={formData.focus}
                  onChange={handleInputChange}
                >
                  <option value="">Ihr Fokus</option>
                  {FOCUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="contact-form-group">
                <label className="contact-form-label" htmlFor="contact-message">
                  Was möchten Sie mit VANTARO erreichen?
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  className="contact-form-textarea"
                  placeholder="Was möchten Sie mit VANTARO erreichen?"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>

              <button type="submit" className="contact-submit-btn">
                Demo-Anfrage vorbereiten <span className="arrow">↗</span>
              </button>

              {submitted && (
                <div className="contact-form-feedback">
                  Danke — Ihre Anfrage ist vorbereitet. Bitte nutzen Sie den E-Mail-Kontakt, um sie abzusenden.
                </div>
              )}
            </form>

            <p className="contact-legal-note">
              Ihre Angaben werden in dieser Demo nicht an einen Server übertragen. Es gelten unser{' '}
              <a href="#impressum">Impressum</a> und die{' '}
              <a href="#datenschutz">Datenschutzerklärung</a>.
            </p>
          </div>

          <div className="contact-visual-col">
            <div className="contact-image-wrapper">
              <div className="contact-cutout-panel">
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
                    href="mailto:rene.schirner@entriks.com?subject=VANTARO%20Pilotgespr%C3%A4ch"
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
    </section>
  );
}
