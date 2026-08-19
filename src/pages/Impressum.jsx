import LegalLayout from './LegalLayout';

export default function Impressum() {
  return (
    <LegalLayout active="impressum">
      <h1>Impressum</h1>
      <p className="legal-lede">
        Angaben gemäß § 5 DDG. Anbieterkennzeichnung für die Website vantaro.io.
        VANTARO ist die Vertriebs- und Matching-Infrastruktur für Finanzdienstleister.
      </p>

      <h2>Anbieter</h2>
      <p>
        <strong>VANTARO</strong>
        <br />
        Geschäftsführer: René Schirner
      </p>
      <p>
        E-Mail:{' '}
        <a href="mailto:rene.schirner@entriks.com">rene.schirner@entriks.com</a>
        <br />
        Internet:{' '}
        <a href="https://vantaro.io/">https://vantaro.io</a>
      </p>
      <p className="legal-note">
        Eine ladungsfähige Postanschrift wird im Rahmen des Livegangs ergänzt.
        Bis dahin erreichen Sie uns verbindlich über die oben genannte E-Mail-Adresse.
      </p>

      <h2>Kontakt</h2>
      <p>
        Für Fragen zum Angebot, zu Pilotprojekten und zu dieser Website schreiben
        Sie an{' '}
        <a href="mailto:rene.schirner@entriks.com">rene.schirner@entriks.com</a>{' '}
        oder nutzen Sie das Formular unter{' '}
        <a href="#kontakt">Kontakt</a>.
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        Verantwortlich gemäß § 18 Abs. 2 MStV: René Schirner, erreichbar über die
        oben genannten Kontaktdaten.
      </p>

      <h2>Hinweis zum Angebot</h2>
      <p>
        VANTARO ist keine Versicherung, kein Versicherungsvermittler und erbringt
        keine Versicherungsberatung. Fachliche Beratung, Produktauswahl und
        Vermittlung bleiben beim jeweils zuständigen und zugelassenen Vermittler.
        Inhalte dieser Website dienen der Darstellung des Systems und ersetzen
        keine individuelle Rechts-, Steuer- oder Versicherungsberatung.
      </p>

      <h2>Datenschutz und Webanalyse</h2>
      <p>
        Diese Website nutzt — nur mit Ihrer Einwilligung —{' '}
        <strong>Google Analytics</strong> (Google Ireland Limited) zur
        statistischen Auswertung der Seitenaufrufe. Mess-ID: G-Q63XEK9EGN.
        Ohne Zustimmung unter „Statistik“ in den Cookie-Einstellungen wird
        kein Tracking durch Google geladen. Ausführliche Informationen zur
        Datenverarbeitung, zu Ihren Rechten und zum Widerruf finden Sie in
        unserer{' '}
        <a href="#datenschutz">Datenschutzerklärung</a>, Abschnitt
        „Google Analytics“.
      </p>

      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr" rel="noopener noreferrer" target="_blank">
          https://ec.europa.eu/consumers/odr
        </a>
        . Wir sind nicht verpflichtet und nicht bereit, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf
        diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis
        10 DDG sind wir als Diensteanbieter nicht verpflichtet, übermittelte oder
        gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
        forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen
        zur Entfernung oder Sperrung der Nutzung von Informationen nach den
        allgemeinen Gesetzen bleiben unberührt.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot kann Links zu externen Websites Dritter enthalten, auf
        deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte
        übernehmen wir keine Gewähr. Für die Inhalte der verlinkten Seiten ist
        stets der jeweilige Anbieter oder Betreiber verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
        Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
        Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
        Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des
        jeweiligen Autors bzw. Erstellers.
      </p>

      <p className="legal-updated">Stand: August 2026</p>
    </LegalLayout>
  );
}
