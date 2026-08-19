import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Brand from './Brand';

const LINKS = [
  { href: '#system', label: 'Das System' },
  { href: '#sparten', label: 'Sparten' },
  { href: '#qualitaet', label: 'Qualität' },
  { href: '#referenzen', label: 'Referenzen' },
  { href: '#ueber-uns', label: 'Über uns' },
  { href: '#preise', label: 'Preise' },
  { href: '#kontakt', label: 'Kontakt' },
];

export default function Header({ solid = false }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    return () => document.body.classList.remove('menu-open');
  }, [open]);

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 60);

      const headerOffset = 110;
      let current = '';
      LINKS.forEach((link) => {
        const section = document.getElementById(link.href.slice(1));
        if (!section) return;
        if (section.getBoundingClientRect().top <= headerOffset) {
          current = link.href;
        }
      });

      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 120;
      if (atBottom) current = '#kontakt';

      setActive(current);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('hashchange', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('hashchange', update);
    };
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpen(false);
    const onResize = () => {
      if (window.innerWidth > 1020) closeMenu();
    };
    window.addEventListener('hashchange', closeMenu);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('hashchange', closeMenu);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const close = () => setOpen(false);

  const goToSection = (href) => (event) => {
    event.preventDefault();
    const menuWasOpen = open;
    close();
    window.setTimeout(() => {
      if (window.location.hash === href) {
        document.getElementById(href.slice(1))?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        return;
      }
      window.location.hash = href;
    }, menuWasOpen ? 200 : 0);
  };

  return (
    <header className={`site-header${scrolled || solid ? ' site-header--sticky' : ''}`}>
      <div className="wrap nav">
        <Brand />
        <nav
          id="nav-links"
          className={`nav-links${open ? ' open' : ''}`}
          aria-label="Hauptnavigation"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={active === link.href ? 'is-active' : undefined}
              aria-current={active === link.href ? 'location' : undefined}
              onClick={goToSection(link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="menu-toggle"
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={26} strokeWidth={1.8} /> : <Menu size={26} strokeWidth={1.8} />}
        </button>
      </div>
    </header>
  );
}
