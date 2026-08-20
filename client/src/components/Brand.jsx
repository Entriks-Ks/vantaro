export default function Brand() {
  return (
    <a className="brand" href="#top" aria-label="VANTARO Startseite">
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
    </a>
  );
}
