export default function LegalLayout({ children }) {
  return (
    <section className="legal-page" id="inhalt">
      <div className="wrap legal-wrap">
        <article className="legal-doc">{children}</article>
      </div>
    </section>
  );
}
