import { Link } from 'react-router-dom';

export default function Brand({ href = '#top', to, className = '' }) {
  const classes = className ? `brand ${className}` : 'brand';
  const inner = (
    <>
      <img
        className="brand-mark"
        src="/favicon.svg"
        alt=""
        width={40}
        height={40}
      />
      <img
        className="brand-word"
        src="/logo.svg"
        alt="VANTARO"
        width={148}
        height={16}
      />
    </>
  );

  if (to) {
    return (
      <Link className={classes} to={to} aria-label="VANTARO">
        {inner}
      </Link>
    );
  }

  return (
    <a className={classes} href={href} aria-label="VANTARO Startseite">
      {inner}
    </a>
  );
}
