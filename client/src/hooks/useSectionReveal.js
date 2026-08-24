import { useEffect } from 'react';

const SELECTOR = '.hero, .section, .signal-strip, .contact-us-section, footer, section.legal-page';

function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
}

function isPreloading() {
  const preloader = document.getElementById('preloader');
  return (
    document.documentElement.classList.contains('is-preloading') &&
    preloader &&
    preloader.dataset.settled !== 'true'
  );
}

export default function useSectionReveal(deps = []) {
  useEffect(() => {
    let cancelled = false;
    let observer;
    const targets = [];

    const start = () => {
      if (cancelled) return;

      targets.push(...document.querySelectorAll(SELECTOR));
      if (!targets.length) return;

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) {
        document.documentElement.classList.add('js-reveal');
      }

      if (reduce) {
        targets.forEach((el) => el.classList.add('is-in'));
        return;
      }

      const reveal = (el) => {
        el.classList.add('is-in');
        observer?.unobserve(el);
      };

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) reveal(entry.target);
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
      );

      targets.forEach((el) => {
        if (isInViewport(el)) {
          reveal(el);
        } else {
          observer.observe(el);
        }
      });
    };

    if (isPreloading()) {
      window.addEventListener('vantaro:app-ready', start, { once: true });
    } else {
      start();
    }

    return () => {
      cancelled = true;
      window.removeEventListener('vantaro:app-ready', start);
      observer?.disconnect();
      document.documentElement.classList.remove('js-reveal');
      targets.forEach((el) => el.classList.remove('is-in'));
    };
  }, deps);
}
