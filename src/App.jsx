import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Brand from './components/Brand';
import Rest from './Rest';
import CookieConsent from './components/CookieConsent';
import Analytics from './components/Analytics';
import Impressum from './pages/Impressum';
import Datenschutz from './pages/Datenschutz';
import Login from './pages/Login';
import Register from './pages/Register';
import useSectionReveal from './hooks/useSectionReveal';

function AppContent() {
  const location = useLocation();
  const isImpressum = location.hash === '#impressum' || location.pathname === '/impressum';
  const isDatenschutz = location.hash === '#datenschutz' || location.pathname === '/datenschutz';
  const isLogin = location.pathname === '/login';
  const isRegister = location.pathname === '/register';
  const isLegal = isImpressum || isDatenschutz;
  const isAuth = isLogin || isRegister;

  useSectionReveal([location.pathname, location.hash, isLegal]);

  useEffect(() => {
    document.body.classList.toggle('legal-page', isLegal);
    document.body.classList.toggle('auth-page', isAuth);
    document.title = isImpressum
      ? 'Impressum — VANTARO'
      : isDatenschutz
        ? 'Datenschutz — VANTARO'
        : isLogin
          ? 'Anmelden — VANTARO'
          : isRegister
            ? 'Registrieren — VANTARO'
            : 'VANTARO — Qualifizierte Beratungschancen & Makler-Matching für Finanzdienstleister';

    if (isLegal || isAuth) {
      window.scrollTo(0, 0);
      return undefined;
    }

    const id = location.hash.replace('#', '');
    if (!id || id === 'top') {
      if (id === 'top') window.scrollTo(0, 0);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash, isLegal, isAuth, isImpressum, isDatenschutz, isLogin, isRegister]);

  return (
    <>
      {!isAuth && <Header solid={isLegal} />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={
          <>
            <a className="skip-link" href="#inhalt">Zum Inhalt springen</a>
            {isImpressum ? (
              <Impressum />
            ) : isDatenschutz ? (
              <Datenschutz />
            ) : (
              <main id="inhalt">
                <Hero />
                <Rest />
              </main>
            )}
          </>
        } />
      </Routes>
      {!isAuth && (
        <footer>
          <div className="wrap footer-main">
            <div className="footer-brand">
              <Brand />
              <p>Die Umsatzmaschine für Finanzdienstleister — vom Erstkontakt bis zum Ergebnis. Qualifizierte Chancen, exklusives Matching und messbares Follow-up in einer durchgängigen Strecke.</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>Entdecken</h4>
                <a href="#system">Das System</a>
                <a href="#portal">Makler-Workspace</a>
                <a href="#sparten">Sparten &amp; Logik</a>
                <a href="#qualitaet">Qualitätsprozess</a>
                <a href="#referenzen">Maklerstimmen</a>
              </div>
              <div className="footer-col">
                <h4>Starten</h4>
                <a href="#kontakt">Pilotgespräch anfragen</a>
                <a href="#preise">Preise &amp; Richtwerte</a>
                <a href="#faq">FAQ &amp; Antworten</a>
                <a href="mailto:rene.schirner@entriks.com?subject=VANTARO%20Anfrage">rene.schirner@entriks.com</a>
              </div>
              <div className="footer-col">
                <h4>Rechtliches</h4>
                <a href="#impressum">Impressum</a>
                <a href="#datenschutz">Datenschutz</a>
                <a href="#datenschutz">Compliance &amp; Hinweise</a>
              </div>
            </div>
          </div>
          <div className="wrap footer-bottom">
            <span className="footer-copy-text">© {new Date().getFullYear()} VANTARO. Vertriebs- und Matching-Infrastruktur für Finanzdienstleister.</span>
            <nav className="footer-bottom-nav" aria-label="Rechtliches">
              <a href="#impressum">Impressum</a>
              <a href="#datenschutz">Datenschutz</a>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('vantaro:cookies'))}
              >
                Cookie-Einstellungen
              </button>
            </nav>
          </div>
        </footer>
      )}
      <CookieConsent />
      <Analytics />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
