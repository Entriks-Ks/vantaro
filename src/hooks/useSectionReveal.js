import { useEffect } from 'react';

const SELECTOR = '.hero, .section, .signal-strip, .contact-us-section, footer, .legal-page';

function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
}

export default function useSectionReveal(deps = []) {
  useEffect(() => {
    const targets = [...document.querySelectorAll(SELECTOR)];
    if (!targets.length) return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('js-reveal');

    if (reduce) {
      targets.forEach((el) => el.classList.add('is-in'));
      return () => document.documentElement.classList.remove('js-reveal');
    }

    let observer;

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

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('js-reveal');
      targets.forEach((el) => el.classList.remove('is-in'));
    };
  }, deps);
}
