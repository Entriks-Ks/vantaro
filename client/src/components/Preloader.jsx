import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const MIN_MS = 900;
const MAX_MS = 5000;
const FONT_MS = 1500;
const VEIL_MS = 1800;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForEvent(name, timeout) {
  return new Promise((resolve) => {
    if (document.documentElement.dataset.veilReady === 'true') {
      resolve();
      return;
    }

    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener(name, onEvent);
      resolve();
    };

    const onEvent = () => done();
    const timer = window.setTimeout(done, timeout);
    window.addEventListener(name, onEvent, { once: true });
  });
}

function dismissPreloader() {
  const el = document.getElementById('preloader');
  document.documentElement.classList.remove('is-preloading');
  window.dispatchEvent(new Event('vantaro:app-ready'));

  if (!el || el.dataset.settled === 'true') return;
  el.dataset.settled = 'true';
  el.classList.add('is-done');
  el.setAttribute('aria-busy', 'false');
  el.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => el.remove(), 700);
}

export default function Preloader() {
  const { loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const el = document.getElementById('preloader');
    if (!el || el.dataset.settled === 'true') return undefined;

    const safety = window.setTimeout(dismissPreloader, MAX_MS);
    return () => window.clearTimeout(safety);
  }, []);

  useEffect(() => {
    const el = document.getElementById('preloader');
    if (!el || el.dataset.settled === 'true' || loading) return undefined;

    let cancelled = false;

    const run = async () => {
      const remaining = Math.max(0, MIN_MS - performance.now());
      const tasks = [wait(remaining)];

      if (document.fonts?.ready) {
        tasks.push(Promise.race([document.fonts.ready, wait(FONT_MS)]));
      }

      const isLanding =
        location.pathname === '/' &&
        location.hash !== '#impressum' &&
        location.hash !== '#datenschutz';

      if (isLanding) {
        tasks.push(waitForEvent('vantaro:veil-ready', VEIL_MS));
      }

      await Promise.all(tasks);
      if (!cancelled) dismissPreloader();
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [loading, location.pathname, location.hash]);

  return null;
}
