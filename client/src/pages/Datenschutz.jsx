import LegalLayout, { EnglishVersionNote } from './LegalLayout';
import { getLang } from '../lib/i18n';

export default function Datenschutz() {
  return getLang() === 'en' ? <DatenschutzEn /> : <DatenschutzDe />;
}

function DatenschutzDe() {
  return (
    <LegalLayout active="datenschutz">
      <h1>Datenschutz</h1>
      <p className="legal-lede">
        Wir erklären, welche personenbezogenen Daten wir verarbeiten, zu welchem
        Zweck und welche Rechte Sie haben. Diese Erklärung gilt für die Website
        vantaro.io.
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
      </p>
      <p>
        <strong>ENTRIKS L.L.C.</strong> (Betreiberin von VANTARO)
        <br />
        Lot Vaku L2.1, 10000 Prishtina, Kosovo
        <br />
        Geschäftsführer: René Schirner
        <br />
        Telefon: <a href="tel:+38343889344">+383 43 889 344</a>
        <br />
        E-Mail:{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>
        <br />
        Weitere Angaben:{' '}
        <a href="#impressum">Impressum</a>
      </p>

      <h2>2. Hosting und Server-Logfiles</h2>
      <p>
        Beim Aufruf dieser Website werden durch den Hosting-Anbieter
        technisch notwendige Daten in sogenannten Server-Logfiles verarbeitet,
        etwa Browsertyp, Datum und Uhrzeit des Zugriffs, Referrer-URL und
        gekürzte IP-Adresse. Die Verarbeitung erfolgt zur Bereitstellung und
        Sicherheit der Website (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>3. Kontaktaufnahme</h2>
      <p>
        Wenn Sie uns per E-Mail oder über das Kontaktformular schreiben,
        verarbeiten wir die von Ihnen mitgeteilten Daten (Name, E-Mail,
        Unternehmen, Anliegen), um Ihre Anfrage zu beantworten (Art. 6 Abs. 1
        lit. b DSGVO bzw. Art. 6 Abs. 1 lit. f DSGVO).
      </p>
      <p>
        Das Formular auf dieser Website überträgt in der aktuellen Demo keine
        Daten an einen Server. Eine verbindliche Anfrage senden Sie bitte per
        E-Mail an{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>.
      </p>

      <h2>4. Cookies und Einwilligung</h2>
      <p>
        Wir verwenden Cookies und ähnliche Technologien. Technisch notwendige
        Cookies sind erforderlich, damit die Seite funktioniert, insbesondere
        um Ihre Auswahl zu speichern. Optionale Cookies für Statistik und
        Marketing setzen wir nur, wenn Sie einwilligen (Art. 6 Abs. 1 lit. a
        DSGVO, § 25 Abs. 1 TDDDG).
      </p>
      <ul>
        <li>
          <strong>Notwendig:</strong> Speicherung Ihrer Cookie-Auswahl und
          sicherer Betrieb der Seite.
        </li>
        <li>
          <strong>Statistik:</strong> Google Analytics (Google Ireland Limited) —
          hilft uns zu verstehen, wie die Seite genutzt wird. Wird nur geladen,
          wenn Sie unter „Statistik“ einwilligen.
        </li>
        <li>
          <strong>Marketing:</strong> Für relevantere Inhalte und Angebote —
          nur mit Einwilligung.
        </li>
      </ul>
      <p>
        Ihre Auswahl können Sie jederzeit über{' '}
        <button
          type="button"
          className="legal-text-btn"
          onClick={() => window.dispatchEvent(new Event('vantaro:cookies'))}
        >
          Cookie-Einstellungen
        </button>{' '}
        ändern oder widerrufen. Der Widerruf berührt nicht die Rechtmäßigkeit
        der bis dahin erfolgten Verarbeitung.
      </p>

      <h2>5. Google Analytics</h2>
      <p>
        Sofern Sie in den{' '}
        <button
          type="button"
          className="legal-text-btn"
          onClick={() => window.dispatchEvent(new Event('vantaro:cookies'))}
        >
          Cookie-Einstellungen
        </button>{' '}
        der Kategorie „Statistik“ zugestimmt haben, setzen wir{' '}
        <strong>Google Analytics</strong> ein — einen Webanalysedienst der{' '}
        <strong>Google Ireland Limited</strong>, Gordon House, Barrow Street,
        Dublin 4, Irland (nachfolgend „Google“).
      </p>
      <p>
        Google Analytics verwendet Cookies und vergleichbare Technologien, die
        auf Ihrem Endgerät gespeichert werden und die eine Analyse Ihrer
        Nutzung der Website ermöglichen. Dabei können insbesondere folgende
        Daten verarbeitet werden:
      </p>
      <ul>
        <li>gekürzte IP-Adresse</li>
        <li>aufgerufene Seiten und Verweildauer</li>
        <li>Datum und Uhrzeit des Zugriffs</li>
        <li>Referrer-URL (zuvor besuchte Seite)</li>
        <li>Browsertyp, Betriebssystem und Bildschirmauflösung</li>
        <li>Spracheinstellung und ungefährer Standort (auf Länder-/Regionsebene)</li>
      </ul>
      <p>
        <strong>Zweck:</strong> Reichweitenmessung, Analyse des Nutzerverhaltens
        und Verbesserung unseres Webangebots.
        <br />
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO
        (Einwilligung). Ohne Ihre Einwilligung wird Google Analytics nicht
        geladen.
        <br />
        <strong>Mess-ID:</strong> G-Q63XEK9EGN
      </p>
      <p>
        Die durch Google Analytics erzeugten Informationen über Ihre Nutzung
        dieser Website werden in der Regel an einen Server von Google in den
        USA übertragen und dort gespeichert. Google kann dabei als
        Auftragsverarbeiter für uns tätig werden. Für Übermittlungen in
        Drittländer stützt sich Google u.&nbsp;a. auf die von der
        EU-Kommission genehmigten Standardvertragsklauseln.
      </p>
      <p>
        Weitere Informationen finden Sie in der Datenschutzerklärung von Google:{' '}
        <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">
          https://policies.google.com/privacy
        </a>
        . Wie Google Daten bei der Nutzung von Websites und Apps verarbeitet,
        erläutert Google unter{' '}
        <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer" target="_blank">
          https://policies.google.com/technologies/partner-sites
        </a>
        .
      </p>
      <p>
        Sie können die Einwilligung jederzeit widerrufen, indem Sie in den
        Cookie-Einstellungen „Statistik“ deaktivieren und Ihre Auswahl
        speichern. Bereits gespeicherte Analytics-Cookies verlieren dann ihre
        Wirksamkeit für künftige Messungen.
      </p>

      <h2>6. Zahlungsabwicklung</h2>
      <p>
        Lead-Pakete bezahlen Sie per Kreditkarte als Einmalzahlung. Die Zahlung
        wickelt die <strong>ProCredit Bank</strong> auf ihrer eigenen, sicheren
        Zahlungsseite ab. Ihre Kartendaten (vollständige Kartennummer,
        Prüfnummer/CVC) geben Sie ausschließlich dort ein; sie erreichen
        VANTARO zu keinem Zeitpunkt und werden von uns weder gespeichert noch
        verarbeitet. Wir speichern keine Karten für spätere Zahlungen und
        führen keine wiederkehrenden Abbuchungen durch.
      </p>
      <p>
        Nach der Zahlung übermittelt uns die Bank das Ergebnis. Wir speichern
        dazu:
      </p>
      <ul>
        <li>die maskierte Kartennummer (nur die letzten vier Ziffern) und die Kartenmarke (z.&nbsp;B. Visa, Mastercard)</li>
        <li>den Namen des Karteninhabers und das Ablaufdatum der Karte, wie von der Bank übermittelt</li>
        <li>Betrag, Zahlungsstatus, Rechnungsnummer sowie Bestell-ID und Genehmigungscode der Bank</li>
      </ul>
      <p>
        <strong>Zweck:</strong> Rechnungsstellung, Buchhaltung und Nachweis der
        Zahlung.
        <br />
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO
        (Vertragserfüllung) und Art. 6 Abs. 1 lit. c DSGVO
        (handels- und steuerrechtliche Aufbewahrungspflichten).
      </p>
      <p>
        Zum Schutz vor Missbrauch protokollieren wir Zahlungsvorgänge
        (z.&nbsp;B. Zahlung gestartet, bezahlt, abgelehnt) mit IP-Adresse und
        Browserkennung (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse an
        der Sicherheit des Zahlungsverkehrs). Kartendaten enthalten diese
        Protokolle nicht.
      </p>
      {/* Rechtliche Prüfung: Frist für Rechnungen (seit 2025 ggf. 8 statt 10 Jahre für Buchungsbelege, § 147 AO / § 257 HGB i. d. F. BEG IV) und Frist für Sicherheitsprotokolle bestätigen. */}
      <p>
        <strong>Speicherdauer:</strong> Rechnungen und die zugehörigen
        Zahlungsdaten bewahren wir für die gesetzliche Frist von 10 Jahren auf
        (§ 147 AO, § 257 HGB). Sicherheitsprotokolle zu Zahlungsvorgängen
        löschen wir nach 12 Monaten, sofern sie nicht zur Aufklärung eines
        Sicherheitsvorfalls benötigt werden.
      </p>

      <h2>7. Speicherdauer</h2>
      <p>
        Wir speichern personenbezogene Daten nur so lange, wie es für den
        jeweiligen Zweck erforderlich ist oder gesetzliche
        Aufbewahrungspflichten bestehen. Cookie-Einwilligungen speichern wir,
        bis Sie sie ändern oder die Speicherung in Ihrem Browser löschen.
        Kontaktanfragen löschen wir, wenn der Vorgang abgeschlossen ist und
        keine gesetzlichen Pflichten entgegenstehen. Bei Google Analytics
        richtet sich die Speicherdauer nach den Einstellungen in unserem
        Google-Analytics-Konto und den Vorgaben von Google; standardmäßig
        werden Ereignisdaten nach 14 Monaten gelöscht.
      </p>

      <h2>8. Empfänger</h2>
      <p>
        Daten werden nur weitergegeben, wenn dies zur Vertragserfüllung, auf
        Grundlage einer Einwilligung, zur Erfüllung einer rechtlichen Pflicht
        oder zur Wahrung berechtigter Interessen erforderlich ist, etwa an
        Hosting- oder IT-Dienstleister, die weisungsgebunden für uns tätig
        werden. Für Kartenzahlungen ist die <strong>ProCredit Bank</strong>
        Empfängerin der Zahlungsdaten (siehe Abschnitt 6). Sofern Sie der
        Kategorie „Statistik“ zugestimmt haben, werden
        Daten an <strong>Google Ireland Limited</strong> (Google Analytics)
        übermittelt.
      </p>

      <h2>9. Ihre Rechte</h2>
      <p>Sie haben gegenüber uns folgende Rechte:</p>
      <ul>
        <li>Auskunft über die verarbeiteten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO)</li>
        <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
      </ul>
      <p>
        Zur Ausübung Ihrer Rechte schreiben Sie an{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>.
      </p>

      <h2>10. Beschwerderecht</h2>
      <p>
        Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu
        beschweren, insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts.
        Die Bundesbeauftragte für den Datenschutz und die Informationsfreiheit
        finden Sie unter{' '}
        <a href="https://www.bfdi.bund.de" rel="noopener noreferrer" target="_blank">
          www.bfdi.bund.de
        </a>
        .
      </p>

      <h2 id="hinweise">11. Hinweise zur Vermittlung</h2>
      <p>
        VANTARO vermittelt keine Versicherungen und gibt keine Produktempfehlungen.
        Qualifizierte Gesprächschancen werden an passende, selbst verantwortliche
        Vermittler übergeben. Personenbezogene Daten von Endkunden werden nur im
        Rahmen der jeweiligen Vereinbarung, der gesetzlichen Vorgaben und — soweit
        erforderlich — auf Grundlage einer Einwilligung verarbeitet.
      </p>

      <h2>12. Keine automatisierte Entscheidungsfindung</h2>
      <p>
        Es findet keine automatisierte Entscheidungsfindung einschließlich
        Profiling im Sinne von Art. 22 DSGVO statt, die Ihnen gegenüber
        rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich
        beeinträchtigt.
      </p>

      <h2>13. Änderungen</h2>
      <p>
        Wir passen diese Datenschutzerklärung an, wenn sich die Verarbeitung
        oder die Rechtslage ändert. Es gilt die jeweils auf dieser Seite
        veröffentlichte Fassung.
      </p>

      <p className="legal-updated">Stand: August 2026</p>
    </LegalLayout>
  );
}

function openCookieSettings() {
  window.dispatchEvent(new Event('vantaro:cookies'));
}

function DatenschutzEn() {
  return (
    <LegalLayout active="datenschutz">
      <h1>Privacy policy</h1>
      <p className="legal-lede">
        We explain which personal data we process, for what purpose and what
        rights you have. This policy applies to the website vantaro.io.
      </p>
      <EnglishVersionNote />

      <h2>1. Controller</h2>
      <p>
        The controller within the meaning of the General Data Protection
        Regulation (GDPR, German: DSGVO) is:
      </p>
      <p>
        <strong>ENTRIKS L.L.C.</strong> (operator of VANTARO)
        <br />
        Lot Vaku L2.1, 10000 Prishtina, Kosovo
        <br />
        Managing director: René Schirner
        <br />
        Phone: <a href="tel:+38343889344">+383 43 889 344</a>
        <br />
        E-mail:{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>
        <br />
        Further details:{' '}
        <a href="#impressum">Legal notice</a>
      </p>

      <h2>2. Hosting and server log files</h2>
      <p>
        When this website is accessed, the hosting provider processes
        technically necessary data in so-called server log files, such as
        browser type, date and time of access, referrer URL and truncated IP
        address. The processing serves to provide and secure the website
        (Art. 6 (1) (f) GDPR).
      </p>

      <h2>3. Contacting us</h2>
      <p>
        If you write to us by e-mail or via the contact form, we process the
        data you provide (name, e-mail, company, request) in order to answer
        your enquiry (Art. 6 (1) (b) GDPR or Art. 6 (1) (f) GDPR).
      </p>
      <p>
        In the current demo, the form on this website does not transmit any
        data to a server. Please send binding enquiries by e-mail to{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>.
      </p>

      <h2>4. Cookies and consent</h2>
      <p>
        We use cookies and similar technologies. Technically necessary cookies
        are required for the site to function, in particular to store your
        selection. We only set optional cookies for statistics and marketing if
        you consent (Art. 6 (1) (a) GDPR, § 25 (1) TDDDG).
      </p>
      <ul>
        <li>
          <strong>Necessary:</strong> storage of your cookie selection and
          secure operation of the site.
        </li>
        <li>
          <strong>Statistics:</strong> Google Analytics (Google Ireland
          Limited) — helps us understand how the site is used. Only loaded if
          you consent under “Statistics”.
        </li>
        <li>
          <strong>Marketing:</strong> for more relevant content and offers —
          only with consent.
        </li>
      </ul>
      <p>
        You can change or withdraw your selection at any time via the{' '}
        <button type="button" className="legal-text-btn" onClick={openCookieSettings}>
          cookie settings
        </button>
        . Withdrawal does not affect the lawfulness of processing carried out
        up to that point.
      </p>

      <h2>5. Google Analytics</h2>
      <p>
        If you have consented to the “Statistics” category in the{' '}
        <button type="button" className="legal-text-btn" onClick={openCookieSettings}>
          cookie settings
        </button>
        , we use <strong>Google Analytics</strong>, a web analytics service of{' '}
        <strong>Google Ireland Limited</strong>, Gordon House, Barrow Street,
        Dublin 4, Ireland (hereinafter “Google”).
      </p>
      <p>
        Google Analytics uses cookies and comparable technologies that are
        stored on your device and enable an analysis of your use of the
        website. In particular, the following data may be processed:
      </p>
      <ul>
        <li>truncated IP address</li>
        <li>pages visited and time spent on them</li>
        <li>date and time of access</li>
        <li>referrer URL (previously visited page)</li>
        <li>browser type, operating system and screen resolution</li>
        <li>language setting and approximate location (at country/region level)</li>
      </ul>
      <p>
        <strong>Purpose:</strong> audience measurement, analysis of user
        behaviour and improvement of our website.
        <br />
        <strong>Legal basis:</strong> Art. 6 (1) (a) GDPR (consent). Without
        your consent, Google Analytics is not loaded.
        <br />
        <strong>Measurement ID:</strong> G-Q63XEK9EGN
      </p>
      <p>
        The information generated by Google Analytics about your use of this
        website is usually transmitted to a Google server in the USA and stored
        there. Google may act as a processor on our behalf. For transfers to
        third countries, Google relies, among other things, on the standard
        contractual clauses approved by the EU Commission.
      </p>
      <p>
        Further information can be found in Google’s privacy policy:{' '}
        <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">
          https://policies.google.com/privacy
        </a>
        . Google explains how it processes data when you use websites and apps
        at{' '}
        <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer" target="_blank">
          https://policies.google.com/technologies/partner-sites
        </a>
        .
      </p>
      <p>
        You can withdraw your consent at any time by deactivating “Statistics”
        in the cookie settings and saving your selection. Analytics cookies
        already stored then cease to have effect for future measurements.
      </p>

      <h2>6. Payment processing</h2>
      <p>
        You pay for lead packages by credit card as a one-time payment. The
        payment is processed by <strong>ProCredit Bank</strong> on its own
        secure payment page. You enter your card details (full card number,
        card verification code/CVC) exclusively there; they never reach VANTARO
        and are neither stored nor processed by us. We do not store cards for
        later payments and do not make recurring charges.
      </p>
      <p>
        After payment, the bank sends us the result. For this purpose we
        store:
      </p>
      <ul>
        <li>the masked card number (only the last four digits) and the card brand (e.g. Visa, Mastercard)</li>
        <li>the name of the cardholder and the card’s expiry date, as transmitted by the bank</li>
        <li>amount, payment status, invoice number as well as the bank’s order ID and authorisation code</li>
      </ul>
      <p>
        <strong>Purpose:</strong> invoicing, accounting and proof of payment.
        <br />
        <strong>Legal basis:</strong> Art. 6 (1) (b) GDPR (performance of a
        contract) and Art. 6 (1) (c) GDPR (retention obligations under
        commercial and tax law).
      </p>
      <p>
        To protect against misuse, we log payment events (e.g. payment
        started, paid, declined) together with the IP address and browser
        identifier (Art. 6 (1) (f) GDPR, legitimate interest in the security of
        payment transactions). These logs do not contain card data.
      </p>
      <p>
        <strong>Retention period:</strong> we retain invoices and the
        associated payment data for the statutory period of 10 years (§ 147 AO
        (German Fiscal Code), § 257 HGB (German Commercial Code)). We delete
        security logs relating to payment events after 12 months unless they
        are needed to investigate a security incident.
      </p>

      <h2>7. Retention period</h2>
      <p>
        We store personal data only for as long as is necessary for the
        respective purpose or as long as statutory retention obligations exist.
        We store cookie consents until you change them or delete the stored
        data in your browser. We delete contact enquiries once the matter has
        been concluded and no statutory obligations prevent deletion. For
        Google Analytics, the retention period depends on the settings in our
        Google Analytics account and Google’s specifications; by default,
        event data is deleted after 14 months.
      </p>

      <h2>8. Recipients</h2>
      <p>
        Data is only disclosed where this is necessary for the performance of a
        contract, on the basis of consent, to comply with a legal obligation or
        to protect legitimate interests, for example to hosting or IT service
        providers acting on our instructions. For card payments,{' '}
        <strong>ProCredit Bank</strong> is the recipient of the payment data
        (see section 6). If you have consented to the “Statistics” category,
        data is transmitted to <strong>Google Ireland Limited</strong> (Google
        Analytics).
      </p>

      <h2>9. Your rights</h2>
      <p>You have the following rights vis-à-vis us:</p>
      <ul>
        <li>access to the data processed (Art. 15 GDPR)</li>
        <li>rectification of inaccurate data (Art. 16 GDPR)</li>
        <li>erasure (Art. 17 GDPR)</li>
        <li>restriction of processing (Art. 18 GDPR)</li>
        <li>data portability (Art. 20 GDPR)</li>
        <li>objection to processing based on Art. 6 (1) (f) GDPR (Art. 21 GDPR)</li>
        <li>withdrawal of consent given (Art. 7 (3) GDPR)</li>
      </ul>
      <p>
        To exercise your rights, write to{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>.
      </p>

      <h2>10. Right to lodge a complaint</h2>
      <p>
        You have the right to lodge a complaint with a data protection
        supervisory authority, in particular in the member state of your
        habitual residence. The German Federal Commissioner for Data Protection
        and Freedom of Information can be found at{' '}
        <a href="https://www.bfdi.bund.de" rel="noopener noreferrer" target="_blank">
          www.bfdi.bund.de
        </a>
        .
      </p>

      <h2 id="hinweise">11. Notes on intermediation</h2>
      <p>
        VANTARO does not broker insurance and does not make product
        recommendations. Qualified sales opportunities are passed on to
        suitable, independently responsible intermediaries. Personal data of
        end customers is processed only within the scope of the respective
        agreement and the statutory requirements and — where necessary — on
        the basis of consent.
      </p>

      <h2>12. No automated decision-making</h2>
      <p>
        No automated decision-making, including profiling, within the meaning
        of Art. 22 GDPR takes place that produces legal effects concerning you
        or similarly significantly affects you.
      </p>

      <h2>13. Changes</h2>
      <p>
        We adapt this privacy policy when the processing or the legal situation
        changes. The version published on this page at the time applies.
      </p>

      <p className="legal-updated">Last updated: August 2026</p>
    </LegalLayout>
  );
}
