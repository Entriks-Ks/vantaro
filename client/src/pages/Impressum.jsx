import LegalLayout, { EnglishVersionNote } from './LegalLayout';
import { getLang } from '../lib/i18n';

export default function Impressum() {
  return getLang() === 'en' ? <ImpressumEn /> : <ImpressumDe />;
}

function ImpressumDe() {
  return (
    <LegalLayout active="impressum">
      <h1>Impressum</h1>
      <p className="legal-lede">
        Angaben gemäß § 5 DDG. Anbieterkennzeichnung für die Website vantaro.io.
        VANTARO ist die Vertriebs- und Matching-Plattform für Versicherung und Energie.
      </p>

      <h2>Anbieter</h2>
      <p>
        <strong>VANTARO</strong>
        <br />
        Ein Angebot der:
      </p>
      <p>
        <strong>ENTRIKS L.L.C.</strong>
        <br />
        Lot Vaku L2.1
        <br />
        10000 Prishtina
        <br />
        Kosovo
      </p>
      <p>
        Rechtsform: Gesellschaft mit beschränkter Haftung nach kosovarischem
        Recht (L.L.C.)
        <br />
        Sitz und Tätigkeitsland: Kosovo
        <br />
        Register: Kosovo Business Registration Agency (ARBK)
        <br />
        Eindeutige Identifikationsnummer (NUI): 811936668
        <br />
        Geschäftsführer: René Schirner
      </p>
      <p>
        Telefon: <a href="tel:+38343889344">+383 43 889 344</a>
        <br />
        E-Mail:{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>
        <br />
        Internet:{' '}
        <a href="https://vantaro.io/">https://vantaro.io</a>
      </p>

      <h2>Kontakt</h2>
      <p>
        Für Fragen zum Angebot, zu Pilotprojekten und zu dieser Website schreiben
        Sie an{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>{' '}
        oder nutzen Sie das Formular unter{' '}
        <a href="#kontakt">Kontakt</a>.
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        Verantwortlich gemäß § 18 Abs. 2 MStV: René Schirner (Geschäftsführer
        der ENTRIKS L.L.C.), erreichbar über die oben genannten Kontaktdaten.
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

      <p className="legal-updated">Stand: November 2026</p>
    </LegalLayout>
  );
}

function ImpressumEn() {
  return (
    <LegalLayout active="impressum">
      <h1>Legal notice</h1>
      <p className="legal-lede">
        Information pursuant to § 5 DDG (German Digital Services Act). Provider
        identification for the website vantaro.io. VANTARO is the sales and
        matching platform for insurance and energy.
      </p>
      <EnglishVersionNote />

      <h2>Provider</h2>
      <p>
        <strong>VANTARO</strong>
        <br />
        A service of:
      </p>
      <p>
        <strong>ENTRIKS L.L.C.</strong>
        <br />
        Lot Vaku L2.1
        <br />
        10000 Prishtina
        <br />
        Kosovo
      </p>
      <p>
        Legal form: limited liability company under Kosovo law (L.L.C.)
        <br />
        Registered office and country of operation: Kosovo
        <br />
        Register: Kosovo Business Registration Agency (ARBK)
        <br />
        Unique identification number (NUI): 811936668
        <br />
        Managing director: René Schirner
      </p>
      <p>
        Phone: <a href="tel:+38343889344">+383 43 889 344</a>
        <br />
        E-mail:{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>
        <br />
        Website:{' '}
        <a href="https://vantaro.io/">https://vantaro.io</a>
      </p>

      <h2>Contact</h2>
      <p>
        For questions about our services, pilot projects and this website,
        please write to{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>{' '}
        or use the form under{' '}
        <a href="#kontakt">Contact</a>.
      </p>

      <h2>Responsible for content</h2>
      <p>
        Responsible pursuant to § 18 (2) MStV (German Interstate Media
        Treaty): René Schirner (managing director of ENTRIKS L.L.C.), reachable
        via the contact details above.
      </p>

      <h2>Note on our services</h2>
      <p>
        VANTARO is not an insurer, not an insurance intermediary and does not
        provide insurance advice. Professional advice, product selection and
        brokerage remain with the respective competent and licensed
        intermediary. The content of this website serves to present the system
        and does not replace individual legal, tax or insurance advice.
      </p>

      <h2>Data protection and web analytics</h2>
      <p>
        This website uses — only with your consent —{' '}
        <strong>Google Analytics</strong> (Google Ireland Limited) for the
        statistical analysis of page views. Measurement ID: G-Q63XEK9EGN.
        Without consent under “Statistics” in the cookie settings, no Google
        tracking is loaded. Detailed information on data processing, your
        rights and withdrawal of consent can be found in our{' '}
        <a href="#datenschutz">privacy policy</a>, section
        “Google Analytics”.
      </p>

      <h2>EU dispute resolution</h2>
      <p>
        The European Commission provides a platform for online dispute
        resolution (ODR):{' '}
        <a href="https://ec.europa.eu/consumers/odr" rel="noopener noreferrer" target="_blank">
          https://ec.europa.eu/consumers/odr
        </a>
        . We are neither obliged nor willing to participate in dispute
        resolution proceedings before a consumer arbitration board.
      </p>

      <h2>Liability for content</h2>
      <p>
        As a service provider, we are responsible for our own content on these
        pages in accordance with general law pursuant to § 7 (1) DDG. Pursuant
        to §§ 8 to 10 DDG, however, we as a service provider are not obliged to
        monitor transmitted or stored third-party information or to investigate
        circumstances that indicate unlawful activity. Obligations to remove or
        block the use of information under general law remain unaffected.
      </p>

      <h2>Liability for links</h2>
      <p>
        Our website may contain links to external third-party websites over
        whose content we have no influence. We therefore accept no liability
        for this third-party content. The respective provider or operator of
        the linked pages is always responsible for their content.
      </p>

      <h2>Copyright</h2>
      <p>
        The content and works created by the site operators on these pages are
        subject to German copyright law. Reproduction, editing, distribution
        and any kind of exploitation outside the limits of copyright law require
        the written consent of the respective author or creator.
      </p>

      <p className="legal-updated">Last updated: November 2026</p>
    </LegalLayout>
  );
}
