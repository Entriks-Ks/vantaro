export default function LegalLayout({ children }) {
  return (
    <section className="legal-page" id="inhalt">
      <div className="wrap legal-wrap">
        <article className="legal-doc">{children}</article>
      </div>
    </section>
  );
}

/** Shown below the lede of each legal page in English mode only. */
export function EnglishVersionNote() {
  return (
    <p className="legal-note">
      This English version is provided for convenience. In case of any
      discrepancy, the German version shall prevail.
    </p>
  );
}
