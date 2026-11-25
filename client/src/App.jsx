import { Fragment, lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Brand from './components/Brand';
import Rest from './Rest';
import CookieConsent from './components/CookieConsent';
import Analytics from './components/Analytics';
import Impressum from './pages/Impressum';
import Datenschutz from './pages/Datenschutz';
import AGB from './pages/AGB';
import Erstattung from './pages/Erstattung';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvite from './pages/AcceptInvite';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import RequireAuth from './pages/RequireAuth';
import { AuthProvider, useAuth } from './hooks/useAuth';
import useSectionReveal from './hooks/useSectionReveal';
import Preloader from './components/Preloader';
import CardLogos from './components/CardLogos';
import BootScreen from './components/BootScreen';
import ImpersonationBanner from './components/ImpersonationBanner';
import { documentTitle } from './pages/dashboard/helpers';
import { applyTheme, readThemePreference, subscribeTheme, writeThemePreference } from './lib/theme';
import LanguageSwitch from './components/LanguageSwitch';
import { getLang, hasStoredLang, L, setLang, useLang } from './lib/i18n';

// Separate chunk: Berater and admins never download the IT Support console.
const ItSupportApp = lazy(() => import('./pages/itSupport/ItSupportApp'));

function ThemeSync() {
  const { user, loading } = useAuth();

  useEffect(() => subscribeTheme(() => {}), []);

  useEffect(() => {
    if (loading || !user || !user.settings?.appearance) return;
    writeThemePreference(user.settings.appearance);
  }, [loading, user, user?.id, user?.settings?.appearance]);

  return null;
}

/**
 * Keeps the browser language and the account's language (used for e-mails and invoices) in step.
 * A language picked in this browser wins; otherwise the account's saved language is applied.
 * Accounts without a saved language get the current one, so the first confirmation e-mail
 * already matches what the customer saw.
 */
function LanguageSync() {
  const { user, loading, updateProfile } = useAuth();
  const saved = user?.settings?.language || null;

  useEffect(() => {
    if (loading || !user) return;
    if (saved && !hasStoredLang()) {
      setLang(saved);
      return;
    }
    if (saved !== getLang()) {
      updateProfile({ settings: { language: getLang() } }).catch(() => {});
    }
  }, [loading, user, user?.id, saved, updateProfile]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const lang = useLang();
  const isImpressum = location.hash === '#impressum' || location.pathname === '/impressum';
  const isDatenschutz = location.hash === '#datenschutz' || location.pathname === '/datenschutz';
  const isAgb = location.hash === '#agb' || location.pathname === '/agb';
  const isErstattung = location.hash === '#erstattung' || location.pathname === '/erstattung';
  const isLogin = location.pathname === '/login';
  const isAuthCallback = location.pathname === '/auth/callback';
  const isRegister = location.pathname === '/register';
  const isForgotPassword = location.pathname === '/forgot-password';
  const isResetPassword = location.pathname === '/reset-password';
  const isAcceptInvite = location.pathname === '/einladung';
  const isVerifyEmail = location.pathname === '/verify-email';
  const isDashboard = location.pathname.startsWith('/dashboard');
  const isItSupport = location.pathname === '/it-support' || location.pathname.startsWith('/it-support/');
  const isLegal = isImpressum || isDatenschutz || isAgb || isErstattung;
  const isAuth = isLogin || isAuthCallback || isRegister || isForgotPassword || isResetPassword || isAcceptInvite || isVerifyEmail;
  const isAppShell = isAuth || isDashboard || isItSupport;

  useLayoutEffect(() => {
    applyTheme(readThemePreference());
  }, [location.pathname, location.hash]);

  useSectionReveal([location.pathname, location.hash, isLegal]);

  useEffect(() => {
    document.body.classList.toggle('is-legal', isLegal);
    document.body.classList.toggle('auth-page', isAuth);
    document.body.classList.toggle('dashboard-page', isDashboard);
    document.body.classList.toggle('it-support-page', isItSupport);
    // The IT Support console sets its own (English or German) title.
    if (!isItSupport) document.title = documentTitle(location.pathname, location.hash, isAdmin);

    if (isLegal || isAuth || isDashboard || isItSupport) {
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
  }, [location.pathname, location.hash, isLegal, isAuth, isDashboard, isItSupport, isAdmin, lang]);

  // key={lang}: remount the page tree so every text (including memoised lists) switches language together.
  return (
    <Fragment key={lang}>
      <ThemeSync />
      <LanguageSync />
      {isAuth && <LanguageSwitch className="auth-lang-switch" />}
      <ImpersonationBanner />
      <Preloader />
      {!isAppShell && <Header solid={isLegal} />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/einladung" element={<AcceptInvite />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/welcome" element={<Navigate to="/dashboard" replace />} />
        <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard/*"
          element={(
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          )}
        />
        <Route
          path="/it-support/*"
          element={(
            <RequireAuth>
              <Suspense fallback={<BootScreen caption="IT Support" />}>
                <ItSupportApp />
              </Suspense>
            </RequireAuth>
          )}
        />
        <Route path="*" element={
          <>
            <a className="skip-link" href="#inhalt">{L('Zum Inhalt springen', 'Skip to content')}</a>
            {isImpressum ? (
              <Impressum />
            ) : isDatenschutz ? (
              <Datenschutz />
            ) : isAgb ? (
              <AGB />
            ) : isErstattung ? (
              <Erstattung />
            ) : (
              <main id="inhalt">
                <Hero />
                <Rest />
              </main>
            )}
          </>
        } />
      </Routes>
      {!isAppShell && (
        <footer>
          <div className="wrap footer-main">
            <div className="footer-brand">
              <Brand />
              <p>{L('Die Vertriebsplattform für Versicherung und Energie — vom Erstkontakt bis zum Ergebnis. Qualifizierte Chancen, exklusives Matching und messbares Follow-up in einer durchgängigen Strecke.', 'The sales platform for insurance and energy — from first contact to outcome. Qualified opportunities, exclusive matching and measurable follow-up in one seamless workflow.')}</p>
              <address className="footer-company">
                <span className="footer-company__label">{L('Betrieben von', 'Operated by')}</span>
                <strong>ENTRIKS L.L.C.</strong>
                <span>Lot Vaku L2.1, 10000 Prishtina, Kosovo</span>
                <span className="footer-company__contact">
                  <a href="tel:+38343889344">+383 43 889 344</a>
                  <a href="mailto:info@vantaro.io">info@vantaro.io</a>
                </span>
                <span className="footer-company__meta">ARBK · NUI 811936668</span>
              </address>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>{L('Entdecken', 'Discover')}</h4>
                <a href="#system">{L('Das System', 'The system')}</a>
                <a href="#portal">{L('Partnerportal', 'Partner portal')}</a>
                <a href="#sparten">{L('Bereiche & Sparten', 'Lines of business')}</a>
                <a href="#qualitaet">{L('Qualitätsprozess', 'Quality process')}</a>
                <a href="#referenzen">{L('Partnerstimmen', 'Partner voices')}</a>
              </div>
              <div className="footer-col">
                <h4>{L('Starten', 'Get started')}</h4>
                <a href="#kontakt">{L('Pilotgespräch anfragen', 'Request a pilot call')}</a>
                <a href="#preise">{L('Preise & Richtwerte', 'Pricing & guide prices')}</a>
                <a href="#faq">{L('FAQ & Antworten', 'FAQ & answers')}</a>
                <a href="/login">{L('Zum Partnerportal', 'Partner portal login')}</a>
              </div>
              <div className="footer-col">
                <h4>{L('Rechtliches', 'Legal')}</h4>
                <a href="#impressum">{L('Impressum', 'Legal notice')}</a>
                <a href="#datenschutz">{L('Datenschutz', 'Privacy policy')}</a>
                <a href="#agb">{L('AGB', 'Terms & conditions')}</a>
                <a href="#erstattung">{L('Erstattungsrichtlinie', 'Refund policy')}</a>
              </div>
            </div>
          </div>
          <div className="wrap footer-bottom">
            <span className="footer-copy-text">
              © {new Date().getFullYear()} ENTRIKS L.L.C. · VANTARO. {L('Alle Rechte vorbehalten.', 'All rights reserved.')}
            </span>
            <div className="footer-bottom-end">
              <span className="footer-pay">
                <span className="footer-pay__label">{L('Sichere Kartenzahlung', 'Secure card payment')}</span>
                <CardLogos />
              </span>
              <button
                type="button"
                className="footer-cookie-btn"
                onClick={() => window.dispatchEvent(new Event('vantaro:cookies'))}
              >
                {L('Cookie-Einstellungen', 'Cookie settings')}
              </button>
            </div>
          </div>
        </footer>
      )}
      {!isDashboard && !isItSupport && <CookieConsent />}
      <Analytics />
    </Fragment>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
