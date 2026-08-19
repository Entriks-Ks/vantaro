import { useEffect } from 'react';
import { applyConsent, readStoredConsent, trackPageView } from '../lib/analytics';

export default function Analytics() {
  useEffect(() => {
    applyConsent(readStoredConsent() || { necessary: true, analytics: false, marketing: false });

    const onConsent = (event) => {
      if (event.detail) applyConsent(event.detail);
    };

    const onNavigate = () => {
      trackPageView();
    };

    window.addEventListener('vantaro:consent', onConsent);
    window.addEventListener('hashchange', onNavigate);
    return () => {
      window.removeEventListener('vantaro:consent', onConsent);
      window.removeEventListener('hashchange', onNavigate);
    };
  }, []);

  return null;
}
